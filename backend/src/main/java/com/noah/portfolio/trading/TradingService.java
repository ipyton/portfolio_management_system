package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.noah.portfolio.asset.AssetEntity;
import com.noah.portfolio.asset.AssetPriceWindowSnapshot;
import com.noah.portfolio.asset.AssetRepository;
import com.noah.portfolio.asset.AssetSearchDataRepository;
import com.noah.portfolio.asset.AssetType;
import com.noah.portfolio.user.UserEntity;
import com.noah.portfolio.user.UserRepository;

@Service
@Transactional
public class TradingService {

    private static final int SCALE = 6;

    private final UserRepository userRepository;
    private final AssetRepository assetRepository;
    private final HoldingRepository holdingRepository;
    private final TradeHistoryRepository tradeHistoryRepository;
    private final CashAccountRepository cashAccountRepository;
    private final CashTransactionRepository cashTransactionRepository;
    private final AssetSearchDataRepository assetSearchDataRepository;

    public TradingService(
            UserRepository userRepository,
            AssetRepository assetRepository,
            HoldingRepository holdingRepository,
            TradeHistoryRepository tradeHistoryRepository,
            CashAccountRepository cashAccountRepository,
            CashTransactionRepository cashTransactionRepository,
            AssetSearchDataRepository assetSearchDataRepository
    ) {
        this.userRepository = userRepository;
        this.assetRepository = assetRepository;
        this.holdingRepository = holdingRepository;
        this.tradeHistoryRepository = tradeHistoryRepository;
        this.cashAccountRepository = cashAccountRepository;
        this.cashTransactionRepository = cashTransactionRepository;
        this.assetSearchDataRepository = assetSearchDataRepository;
    }

    public TradeResponse buy(TradeRequest request) {
        UserEntity user = requireUser(request.userId());
        AssetEntity asset = requireStockAsset(request.assetId());
        BigDecimal fee = normalizeFee(request.fee());
        BigDecimal amount = normalize(request.quantity().multiply(request.price()));
        BigDecimal totalCost = normalize(amount.add(fee));

        CashAccountEntity cashAccount = findOrCreateCashAccount(user, asset.getCurrency());

        if (cashAccount.getBalance().compareTo(totalCost) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient cash balance.");
        }

        HoldingEntity holding = holdingRepository.findByUserIdAndAssetId(request.userId(), request.assetId())
                .orElse(new HoldingEntity(user, asset, BigDecimal.ZERO.setScale(SCALE), BigDecimal.ZERO.setScale(SCALE)));

        BigDecimal oldQuantity = normalize(holding.getQuantity());
        BigDecimal newQuantity = normalize(oldQuantity.add(request.quantity()));
        BigDecimal oldCostBasis = holding.getAvgCost().multiply(oldQuantity);
        BigDecimal newCostBasis = oldCostBasis.add(totalCost);

        holding.setQuantity(newQuantity);
        holding.setAvgCost(newQuantity.signum() == 0
                ? BigDecimal.ZERO.setScale(SCALE)
                : normalize(newCostBasis.divide(newQuantity, SCALE, RoundingMode.HALF_UP)));
        holding = holdingRepository.save(holding);

        cashAccount.setBalance(normalize(cashAccount.getBalance().subtract(totalCost)));
        cashAccountRepository.save(cashAccount);

        TradeHistoryEntity trade = tradeHistoryRepository.save(new TradeHistoryEntity(
                holding,
                TradeType.BUY,
                normalize(request.quantity()),
                normalize(request.price()),
                amount,
                fee,
                request.note()
        ));

        cashTransactionRepository.save(new CashTransactionEntity(
                user,
                asset.getCurrency(),
                CashTransactionType.BUY,
                totalCost.negate(),
                cashAccount.getBalance(),
                trade.getId(),
                request.note()
        ));

        return new TradeResponse(
                trade.getId(),
                TradeType.BUY.name(),
                user.getId(),
                asset.getId(),
                asset.getSymbol(),
                normalize(request.quantity()),
                normalize(request.price()),
                amount,
                fee,
                holding.getQuantity(),
                holding.getAvgCost(),
                cashAccount.getBalance(),
                asset.getCurrency(),
                request.note()
        );
    }

    public TradeResponse sell(TradeRequest request) {
        UserEntity user = requireUser(request.userId());
        AssetEntity asset = requireStockAsset(request.assetId());
        BigDecimal fee = normalizeFee(request.fee());
        BigDecimal amount = normalize(request.quantity().multiply(request.price()));
        BigDecimal netProceeds = normalize(amount.subtract(fee));

        HoldingEntity holding = holdingRepository.findByUserIdAndAssetId(request.userId(), request.assetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Holding not found."));

        if (holding.getQuantity().compareTo(request.quantity()) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient holding quantity.");
        }

        CashAccountEntity cashAccount = findOrCreateCashAccount(user, asset.getCurrency());

        BigDecimal newQuantity = normalize(holding.getQuantity().subtract(request.quantity()));
        holding.setQuantity(newQuantity);
        if (newQuantity.signum() == 0) {
            holding.setAvgCost(BigDecimal.ZERO.setScale(SCALE));
        }
        holding = holdingRepository.save(holding);

        cashAccount.setBalance(normalize(cashAccount.getBalance().add(netProceeds)));
        cashAccountRepository.save(cashAccount);

        TradeHistoryEntity trade = tradeHistoryRepository.save(new TradeHistoryEntity(
                holding,
                TradeType.SELL,
                normalize(request.quantity()),
                normalize(request.price()),
                amount,
                fee,
                request.note()
        ));

        cashTransactionRepository.save(new CashTransactionEntity(
                user,
                asset.getCurrency(),
                CashTransactionType.SELL,
                netProceeds,
                cashAccount.getBalance(),
                trade.getId(),
                request.note()
        ));

        return new TradeResponse(
                trade.getId(),
                TradeType.SELL.name(),
                user.getId(),
                asset.getId(),
                asset.getSymbol(),
                normalize(request.quantity()),
                normalize(request.price()),
                amount,
                fee,
                holding.getQuantity(),
                holding.getAvgCost(),
                cashAccount.getBalance(),
                asset.getCurrency(),
                request.note()
        );
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
                        new CashAccountEntity(user, currency, BigDecimal.ZERO.setScale(SCALE))
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
                holding.getId(),
                asset.getId(),
                asset.getSymbol(),
                asset.getCurrency(),
                trade.getTradeType().name(),
                trade.getQuantity(),
                trade.getPrice(),
                trade.getAmount(),
                trade.getFee(),
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
}
