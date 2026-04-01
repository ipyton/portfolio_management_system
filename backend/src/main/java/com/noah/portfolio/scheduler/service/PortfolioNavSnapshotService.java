package com.noah.portfolio.scheduler.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.noah.portfolio.analytics.entity.PortfolioNavDailyEntity;
import com.noah.portfolio.analytics.repository.PortfolioNavDailyRepository;
import com.noah.portfolio.asset.repository.AssetPriceDailyRepository;
import com.noah.portfolio.fx.service.FxRateService;
import com.noah.portfolio.scheduler.config.SchedulerProperties;
import com.noah.portfolio.trading.repository.CashAccountRepository;
import com.noah.portfolio.trading.entity.CashTransactionEntity;
import com.noah.portfolio.trading.repository.CashTransactionRepository;
import com.noah.portfolio.trading.model.CashTransactionType;
import com.noah.portfolio.trading.entity.HoldingEntity;
import com.noah.portfolio.trading.repository.HoldingRepository;
import com.noah.portfolio.user.entity.UserEntity;
import com.noah.portfolio.user.repository.UserRepository;

@Service
public class PortfolioNavSnapshotService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioNavSnapshotService.class);
    private static final int SCALE = 6;

    private final UserRepository userRepository;
    private final HoldingRepository holdingRepository;
    private final CashAccountRepository cashAccountRepository;
    private final CashTransactionRepository cashTransactionRepository;
    private final AssetPriceDailyRepository assetPriceDailyRepository;
    private final PortfolioNavDailyRepository portfolioNavDailyRepository;
    private final FxRateService fxRateService;
    private final SchedulerProperties schedulerProperties;

    public PortfolioNavSnapshotService(
            UserRepository userRepository,
            HoldingRepository holdingRepository,
            CashAccountRepository cashAccountRepository,
            CashTransactionRepository cashTransactionRepository,
            AssetPriceDailyRepository assetPriceDailyRepository,
            PortfolioNavDailyRepository portfolioNavDailyRepository,
            FxRateService fxRateService,
            SchedulerProperties schedulerProperties
    ) {
        this.userRepository = userRepository;
        this.holdingRepository = holdingRepository;
        this.cashAccountRepository = cashAccountRepository;
        this.cashTransactionRepository = cashTransactionRepository;
        this.assetPriceDailyRepository = assetPriceDailyRepository;
        this.portfolioNavDailyRepository = portfolioNavDailyRepository;
        this.fxRateService = fxRateService;
        this.schedulerProperties = schedulerProperties;
    }

    @Transactional
    public void buildDailySnapshots() {
        ZoneId zoneId = ZoneId.of(schedulerProperties.getZone());
        LocalDate navDate = LocalDate.now(zoneId);
        String reportingCurrency = fxRateService.reportingCurrency();

        int updated = 0;
        for (UserEntity user : userRepository.findAll()) {
            upsertSnapshotForUser(user, navDate, zoneId, reportingCurrency);
            updated++;
        }

        log.info("Portfolio NAV snapshots refreshed. navDate={}, reportingCurrency={}, userCount={}", navDate, reportingCurrency, updated);
    }

    private void upsertSnapshotForUser(UserEntity user, LocalDate navDate, ZoneId zoneId, String reportingCurrency) {
        List<HoldingEntity> holdings = holdingRepository.findActiveHoldingsWithAssetDetailsByUserId(user.getId());
        Map<Long, AssetPriceDailyRepository.AssetLatestPriceView> latestPricesByAssetId = holdings.isEmpty()
                ? Map.of()
                : assetPriceDailyRepository.findLatestPriceViewsByAssetIdIn(
                        holdings.stream().map(holding -> holding.getAsset().getId()).distinct().toList()
                ).stream().collect(Collectors.toMap(
                        AssetPriceDailyRepository.AssetLatestPriceView::getAssetId,
                        latestPrice -> latestPrice
                ));

        BigDecimal holdingValue = holdings.stream()
                .map(holding -> {
                    AssetPriceDailyRepository.AssetLatestPriceView latestPrice = latestPricesByAssetId.get(holding.getAsset().getId());
                    if (latestPrice == null || latestPrice.getClose() == null) {
                        return null;
                    }
                    BigDecimal price = latestPrice.getClose();
                    BigDecimal nativeValue = normalize(holding.getQuantity().multiply(price));
                    return convertIfAvailable(nativeValue, holding.getAsset().getCurrency(), reportingCurrency);
                })
                .filter(Objects::nonNull)
                .reduce(zero(), BigDecimal::add);

        BigDecimal cashValue = cashAccountRepository.findByUserIdOrderByCurrencyAsc(user.getId()).stream()
                .map(account -> convertIfAvailable(account.getBalance(), account.getCurrency(), reportingCurrency))
                .filter(Objects::nonNull)
                .reduce(zero(), BigDecimal::add);

        BigDecimal totalValue = normalize(holdingValue.add(cashValue));
        Optional<PortfolioNavDailyEntity> previousSnapshot = portfolioNavDailyRepository
                .findTopByUser_IdAndNavDateLessThanOrderByNavDateDesc(user.getId(), navDate);

        BigDecimal dailyReturn = resolveDailyReturn(user.getId(), navDate, zoneId, reportingCurrency, previousSnapshot, totalValue);
        BigDecimal netValue = resolveNetValue(previousSnapshot, dailyReturn);

        PortfolioNavDailyEntity snapshot = portfolioNavDailyRepository.findByUser_IdAndNavDate(user.getId(), navDate)
                .orElseGet(() -> new PortfolioNavDailyEntity(user, navDate, totalValue, holdingValue, cashValue, netValue, dailyReturn));
        snapshot.update(totalValue, holdingValue, cashValue, netValue, dailyReturn);
        portfolioNavDailyRepository.save(snapshot);
    }

    private BigDecimal resolveDailyReturn(
            Long userId,
            LocalDate navDate,
            ZoneId zoneId,
            String reportingCurrency,
            Optional<PortfolioNavDailyEntity> previousSnapshot,
            BigDecimal totalValue
    ) {
        if (previousSnapshot.isEmpty() || previousSnapshot.get().getTotalValue() == null
                || previousSnapshot.get().getTotalValue().compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        Instant startInclusive = previousSnapshot.get().getNavDate().plusDays(1).atStartOfDay(zoneId).toInstant();
        Instant endExclusive = navDate.plusDays(1).atStartOfDay(zoneId).toInstant();
        BigDecimal externalFlow = cashTransactionRepository.findSuccessfulTransactionsInWindow(
                        userId,
                        // Business rule: dividends are treated as investment return, not external cash flow.
                        List.of(CashTransactionType.DEPOSIT, CashTransactionType.WITHDRAW),
                        startInclusive,
                        endExclusive
                ).stream()
                .map(tx -> convertIfAvailable(
                        tx.getAmount() == null ? zero() : tx.getAmount(),
                        tx.getCurrency(),
                        reportingCurrency
                ))
                .filter(Objects::nonNull)
                .reduce(zero(), BigDecimal::add);

        BigDecimal numerator = totalValue.subtract(previousSnapshot.get().getTotalValue()).subtract(externalFlow);
        return numerator.divide(previousSnapshot.get().getTotalValue(), SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveNetValue(Optional<PortfolioNavDailyEntity> previousSnapshot, BigDecimal dailyReturn) {
        if (previousSnapshot.isEmpty()) {
            return BigDecimal.ONE.setScale(SCALE, RoundingMode.HALF_UP);
        }
        BigDecimal previousNetValue = previousSnapshot.get().getNetValue();
        if (previousNetValue == null) {
            previousNetValue = BigDecimal.ONE.setScale(SCALE, RoundingMode.HALF_UP);
        }
        if (dailyReturn == null) {
            return normalize(previousNetValue);
        }
        return normalize(previousNetValue.multiply(BigDecimal.ONE.add(dailyReturn)));
    }

    private BigDecimal convertIfAvailable(BigDecimal amount, String fromCurrency, String reportingCurrency) {
        return fxRateService.convert(amount, fromCurrency, reportingCurrency)
                .map(value -> value.setScale(SCALE, RoundingMode.HALF_UP))
                .orElse(null);
    }

    private BigDecimal normalize(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP);
    }
}
