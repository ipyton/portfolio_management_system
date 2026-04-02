package com.noah.portfolio.trading.service;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.noah.portfolio.asset.entity.AssetEntity;
import com.noah.portfolio.asset.model.AssetPriceWindowSnapshot;
import com.noah.portfolio.asset.repository.AssetRepository;
import com.noah.portfolio.asset.repository.AssetSearchDataRepository;
import com.noah.portfolio.asset.model.AssetType;
import com.noah.portfolio.fx.service.FxRateService;
import com.noah.portfolio.user.entity.UserEntity;
import com.noah.portfolio.user.repository.UserRepository;

@Service
@Transactional
public class TradingService {

    private static final int SCALE = 6;
    private static final String SETTLEMENT_CURRENCY = "USD";

    private final UserRepository userRepository;
    private final AssetRepository assetRepository;
    private final HoldingRepository holdingRepository;
    private final TradeHistoryRepository tradeHistoryRepository;
    private final CashAccountRepository cashAccountRepository;
    private final CashTransactionRepository cashTransactionRepository;
    private final AssetSearchDataRepository assetSearchDataRepository;
    private final FxRateService fxRateService;

    public TradingService(
            UserRepository userRepository,
            AssetRepository assetRepository,
            HoldingRepository holdingRepository,
            TradeHistoryRepository tradeHistoryRepository,
            CashAccountRepository cashAccountRepository,
            CashTransactionRepository cashTransactionRepository,
            AssetSearchDataRepository assetSearchDataRepository,
            FxRateService fxRateService
    ) {
        this.userRepository = userRepository;
        this.assetRepository = assetRepository;
        this.holdingRepository = holdingRepository;
        this.tradeHistoryRepository = tradeHistoryRepository;
        this.cashAccountRepository = cashAccountRepository;
        this.cashTransactionRepository = cashTransactionRepository;
        this.assetSearchDataRepository = assetSearchDataRepository;
        this.fxRateService = fxRateService;
    }

    public TradeResponse buy(TradeRequest request) {
        UserEntity user = requireUser(request.userId());
        AssetEntity asset = requireStockAsset(request.assetId());
        String bizId = requireBizId(request.bizId());
        TradeHistoryEntity existing = tradeHistoryRepository.findByBizId(bizId).orElse(null);
        if (existing != null) {
            validateExistingTrade(existing, user.getId(), asset.getId(), TradeType.BUY, request);
            return toTradeResponse(existing);
        }

        BigDecimal fee = normalizeFee(request.fee());
        BigDecimal quantity = normalize(request.quantity());
        BigDecimal price = normalize(request.price());
        BigDecimal amount = normalize(quantity.multiply(price));
        BigDecimal totalCost = normalize(amount.add(fee));
        BigDecimal settledTotalCost = convertToSettlementAmount(totalCost, asset.getCurrency());

        CashAccountEntity cashAccount = findOrCreateCashAccount(user, SETTLEMENT_CURRENCY);

        if (cashAccount.getAvailableBalance().compareTo(settledTotalCost) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient cash balance.");
        }

        HoldingEntity holding = holdingRepository.findByUserIdAndAssetId(request.userId(), request.assetId())
                .orElse(new HoldingEntity(user, asset, BigDecimal.ZERO.setScale(SCALE), BigDecimal.ZERO.setScale(SCALE)));

        BigDecimal oldQuantity = normalize(holding.getQuantity());
        BigDecimal newQuantity = normalize(oldQuantity.add(quantity));
        BigDecimal oldCostBasis = holding.getAvgCost().multiply(oldQuantity);
        BigDecimal newCostBasis = oldCostBasis.add(totalCost);

        holding.setQuantity(newQuantity);
        holding.setAvgCost(newQuantity.signum() == 0
                ? BigDecimal.ZERO.setScale(SCALE)
                : normalize(newCostBasis.divide(newQuantity, SCALE, RoundingMode.HALF_UP)));
        holding = holdingRepository.save(holding);

        BigDecimal availableAfter = normalize(cashAccount.getAvailableBalance().subtract(settledTotalCost));
        BigDecimal frozenAfter = normalize(cashAccount.getFrozenBalance());
        cashAccount.setBalances(availableAfter, frozenAfter);
        cashAccountRepository.save(cashAccount);

        TradeHistoryEntity trade = tradeHistoryRepository.save(new TradeHistoryEntity(
                bizId,
                holding,
                TradeType.BUY,
                OperationStatus.SUCCESS,
                quantity,
                price,
                amount,
                fee,
                holding.getQuantity(),
                holding.getAvgCost(),
                request.note()
        ));

        cashTransactionRepository.save(new CashTransactionEntity(
                bizId,
                user,
                SETTLEMENT_CURRENCY,
                CashTransactionType.BUY,
                OperationStatus.SUCCESS,
                settledTotalCost.negate(),
                cashAccount.getBalance(),
                cashAccount.getAvailableBalance(),
                cashAccount.getFrozenBalance(),
                trade.getId(),
                request.note()
        ));

        return toTradeResponse(trade);
    }

    public TradeResponse sell(TradeRequest request) {
        UserEntity user = requireUser(request.userId());
        AssetEntity asset = requireStockAsset(request.assetId());
        String bizId = requireBizId(request.bizId());
        TradeHistoryEntity existing = tradeHistoryRepository.findByBizId(bizId).orElse(null);
        if (existing != null) {
            validateExistingTrade(existing, user.getId(), asset.getId(), TradeType.SELL, request);
            return toTradeResponse(existing);
        }

        BigDecimal fee = normalizeFee(request.fee());
        BigDecimal quantity = normalize(request.quantity());
        BigDecimal price = normalize(request.price());
        BigDecimal amount = normalize(quantity.multiply(price));
        BigDecimal netProceeds = normalize(amount.subtract(fee));
        BigDecimal settledNetProceeds = convertToSettlementAmount(netProceeds, asset.getCurrency());

        HoldingEntity holding = holdingRepository.findByUserIdAndAssetId(request.userId(), request.assetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Holding not found."));

        if (holding.getQuantity().compareTo(quantity) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient holding quantity.");
        }

        CashAccountEntity cashAccount = findOrCreateCashAccount(user, SETTLEMENT_CURRENCY);

        BigDecimal newQuantity = normalize(holding.getQuantity().subtract(quantity));
        holding.setQuantity(newQuantity);
        if (newQuantity.signum() == 0) {
            holding.setAvgCost(BigDecimal.ZERO.setScale(SCALE));
        }
        holding = holdingRepository.save(holding);

        BigDecimal availableAfter = normalize(cashAccount.getAvailableBalance().add(settledNetProceeds));
        BigDecimal frozenAfter = normalize(cashAccount.getFrozenBalance());
        cashAccount.setBalances(availableAfter, frozenAfter);
        cashAccountRepository.save(cashAccount);

        TradeHistoryEntity trade = tradeHistoryRepository.save(new TradeHistoryEntity(
                bizId,
                holding,
                TradeType.SELL,
                OperationStatus.SUCCESS,
                quantity,
                price,
                amount,
                fee,
                holding.getQuantity(),
                holding.getAvgCost(),
                request.note()
        ));

        cashTransactionRepository.save(new CashTransactionEntity(
                bizId,
                user,
                SETTLEMENT_CURRENCY,
                CashTransactionType.SELL,
                OperationStatus.SUCCESS,
                settledNetProceeds,
                cashAccount.getBalance(),
                cashAccount.getAvailableBalance(),
                cashAccount.getFrozenBalance(),
                trade.getId(),
                request.note()
        ));

        return toTradeResponse(trade);
    }

    @Transactional(readOnly = true)
    public TradePreviewResponse previewBuy(TradeRequest request) {
        return preview(request, TradeType.BUY);
    }

    @Transactional(readOnly = true)
    public TradePreviewResponse previewSell(TradeRequest request) {
        return preview(request, TradeType.SELL);
    }

    @Transactional(readOnly = true)
    public HoldingResponse getHoldings(Long userId) {
        ensureUserExists(userId);
        List<HoldingEntity> holdings = holdingRepository.findByUserIdOrderByIdDesc(userId);
        Map<Long, AssetPriceWindowSnapshot> priceWindows = assetSearchDataRepository.findLatestPriceWindows(
                holdings.stream().map(holding -> holding.getAsset().getId()).toList()
        );
        List<HoldingItem> items = holdings.stream()
                .map(holding -> toHoldingItem(holding, priceWindows.get(holding.getAsset().getId())))
                .toList();
        return new HoldingResponse(userId, items.size(), items);
    }

    @Transactional(readOnly = true)
    public TradeHistoryResponse getTradeHistory(Long userId) {
        ensureUserExists(userId);
        List<TradeHistoryItem> items = tradeHistoryRepository.findByHoldingUserIdOrderByIdDesc(userId).stream()
                .map(this::toTradeHistoryItem)
                .toList();
        return new TradeHistoryResponse(userId, items.size(), items);
    }

    private UserEntity requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }
    }

    private AssetEntity requireStockAsset(Long assetId) {
        AssetEntity asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found."));
        if (asset.getAssetType() != AssetType.STOCK) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only stock assets are supported.");
        }
        return asset;
    }

    private BigDecimal normalizeFee(BigDecimal fee) {
        return normalize(fee == null ? BigDecimal.ZERO : fee);
    }

    private BigDecimal normalize(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }

    private CashAccountEntity findOrCreateCashAccount(UserEntity user, String currency) {
        return cashAccountRepository.findByUserIdAndCurrency(user.getId(), currency)
                .orElseGet(() -> cashAccountRepository.save(
                        new CashAccountEntity(
                                user,
                                currency,
                                BigDecimal.ZERO.setScale(SCALE),
                                BigDecimal.ZERO.setScale(SCALE)
                        )
                ));
    }

    private HoldingItem toHoldingItem(HoldingEntity holding, AssetPriceWindowSnapshot priceWindow) {
        BigDecimal latestClose = priceWindow == null ? null : priceWindow.latestClose();
        BigDecimal dailyChange = resolveDailyChange(priceWindow);
        BigDecimal dailyChangePercent = resolveDailyChangePercent(priceWindow);
        BigDecimal marketValue = latestClose == null ? null : normalize(latestClose.multiply(holding.getQuantity()));
        BigDecimal unrealizedPnl = marketValue == null
                ? null
                : normalize(marketValue.subtract(holding.getAvgCost().multiply(holding.getQuantity())));

        return new HoldingItem(
                holding.getId(),
                holding.getAsset().getId(),
                holding.getAsset().getSymbol(),
                holding.getAsset().getName(),
                holding.getAsset().getCurrency(),
                holding.getQuantity(),
                holding.getAvgCost(),
                latestClose,
                priceWindow == null ? null : priceWindow.latestTradeDate(),
                dailyChange,
                dailyChangePercent,
                marketValue,
                unrealizedPnl
        );
    }

    private TradeHistoryItem toTradeHistoryItem(TradeHistoryEntity trade) {
        HoldingEntity holding = trade.getHolding();
        AssetEntity asset = holding.getAsset();
        return new TradeHistoryItem(
                trade.getId(),
                trade.getBizId(),
                holding.getId(),
                asset.getId(),
                asset.getSymbol(),
                asset.getCurrency(),
                trade.getTradeType().name(),
                trade.getStatus().name(),
                trade.getQuantity(),
                trade.getPrice(),
                trade.getAmount(),
                trade.getFee(),
                trade.getHoldingQuantityAfter(),
                trade.getHoldingAvgCostAfter(),
                trade.getTradedAt(),
                trade.getNote()
        );
    }

    private BigDecimal resolveDailyChange(AssetPriceWindowSnapshot priceWindow) {
        if (priceWindow == null || priceWindow.latestClose() == null || priceWindow.previousClose() == null) {
            return null;
        }
        return normalize(priceWindow.latestClose().subtract(priceWindow.previousClose()));
    }

    private BigDecimal resolveDailyChangePercent(AssetPriceWindowSnapshot priceWindow) {
        BigDecimal dailyChange = resolveDailyChange(priceWindow);
        if (dailyChange == null || priceWindow.previousClose() == null || priceWindow.previousClose().signum() == 0) {
            return null;
        }
        return dailyChange.divide(priceWindow.previousClose(), SCALE, RoundingMode.HALF_UP);
    }

    private TradePreviewResponse preview(TradeRequest request, TradeType tradeType) {
        UserEntity user = requireUser(request.userId());
        AssetEntity asset = requireStockAsset(request.assetId());
        BigDecimal quantity = normalize(request.quantity());
        BigDecimal price = normalize(request.price());
        BigDecimal fee = normalizeFee(request.fee());
        BigDecimal amount = normalize(quantity.multiply(price));
        BigDecimal tradeCashInAssetCurrency = tradeType == TradeType.BUY
                ? normalize(amount.add(fee))
                : normalize(amount.subtract(fee));
        BigDecimal grossCashImpact = tradeType == TradeType.BUY
                ? convertToSettlementAmount(tradeCashInAssetCurrency, asset.getCurrency()).negate()
                : convertToSettlementAmount(tradeCashInAssetCurrency, asset.getCurrency());

        String message = tradeType == TradeType.BUY
                ? "Preview only. Buying will reduce USD cash by converted amount plus fee."
                : "Preview only. Selling will increase USD cash by converted amount minus fee.";

        return new TradePreviewResponse(
                tradeType.name(),
                user.getId(),
                asset.getId(),
                quantity,
                price,
                amount,
                fee,
                grossCashImpact,
                SETTLEMENT_CURRENCY,
                message
        );
    }

    private BigDecimal convertToSettlementAmount(BigDecimal amount, String sourceCurrency) {
        String normalizedSourceCurrency = sourceCurrency == null ? null : sourceCurrency.trim().toUpperCase();
        if (SETTLEMENT_CURRENCY.equals(normalizedSourceCurrency)) {
            return normalize(amount);
        }
        return fxRateService.convert(amount, normalizedSourceCurrency, SETTLEMENT_CURRENCY)
                .map(this::normalize)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "FX rate unavailable for " + normalizedSourceCurrency + " to " + SETTLEMENT_CURRENCY + "."
                ));
    }

    private TradeResponse toTradeResponse(TradeHistoryEntity trade) {
        HoldingEntity holding = trade.getHolding();
        AssetEntity asset = holding.getAsset();
        CashTransactionEntity cashTransaction = cashTransactionRepository.findFirstByRefTradeIdOrderByIdDesc(trade.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Cash transaction not found for trade " + trade.getId() + "."
                ));

        return new TradeResponse(
                trade.getId(),
                trade.getBizId(),
                trade.getTradeType().name(),
                trade.getStatus().name(),
                holding.getUser().getId(),
                asset.getId(),
                asset.getSymbol(),
                trade.getQuantity(),
                trade.getPrice(),
                trade.getAmount(),
                trade.getFee(),
                trade.getHoldingQuantityAfter(),
                trade.getHoldingAvgCostAfter(),
                cashTransaction.getBalanceAfter(),
                cashTransaction.getAvailableBalanceAfter(),
                cashTransaction.getFrozenBalanceAfter(),
                asset.getCurrency(),
                trade.getNote()
        );
    }

    private void validateExistingTrade(
            TradeHistoryEntity existing,
            Long userId,
            Long assetId,
            TradeType tradeType,
            TradeRequest request
    ) {
        if (!Objects.equals(existing.getHolding().getUser().getId(), userId)
                || !Objects.equals(existing.getHolding().getAsset().getId(), assetId)
                || existing.getTradeType() != tradeType
                || normalize(existing.getQuantity()).compareTo(normalize(request.quantity())) != 0
                || normalize(existing.getPrice()).compareTo(normalize(request.price())) != 0
                || normalize(existing.getFee()).compareTo(normalizeFee(request.fee())) != 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "bizId already exists for a different trade request.");
        }
    }

    private String requireBizId(String bizId) {
        if (!StringUtils.hasText(bizId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bizId must not be blank.");
        }
        return bizId.trim();
    }
}
