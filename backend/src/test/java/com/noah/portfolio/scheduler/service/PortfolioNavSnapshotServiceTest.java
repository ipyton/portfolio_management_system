package com.noah.portfolio.scheduler.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.noah.portfolio.analytics.entity.PortfolioNavDailyEntity;
import com.noah.portfolio.analytics.repository.PortfolioNavDailyRepository;
import com.noah.portfolio.asset.repository.AssetPriceDailyRepository;
import com.noah.portfolio.fx.service.FxRateService;
import com.noah.portfolio.scheduler.config.SchedulerProperties;
import com.noah.portfolio.trading.entity.CashAccountEntity;
import com.noah.portfolio.trading.entity.CashTransactionEntity;
import com.noah.portfolio.trading.entity.HoldingEntity;
import com.noah.portfolio.trading.repository.CashAccountRepository;
import com.noah.portfolio.trading.repository.CashTransactionRepository;
import com.noah.portfolio.trading.repository.HoldingRepository;
import com.noah.portfolio.user.entity.UserEntity;
import com.noah.portfolio.user.repository.UserRepository;

class PortfolioNavSnapshotServiceTest {

    @Test
    void buildSnapshotForUser_adjustsExtremeDailyReturnWhenPreviousDayExternalFlowIsLarge() {
        UserRepository userRepository = mock(UserRepository.class);
        HoldingRepository holdingRepository = mock(HoldingRepository.class);
        CashAccountRepository cashAccountRepository = mock(CashAccountRepository.class);
        CashTransactionRepository cashTransactionRepository = mock(CashTransactionRepository.class);
        AssetPriceDailyRepository assetPriceDailyRepository = mock(AssetPriceDailyRepository.class);
        PortfolioNavDailyRepository portfolioNavDailyRepository = mock(PortfolioNavDailyRepository.class);
        FxRateService fxRateService = mock(FxRateService.class);
        SchedulerProperties schedulerProperties = mock(SchedulerProperties.class);

        PortfolioNavSnapshotService service = new PortfolioNavSnapshotService(
                userRepository,
                holdingRepository,
                cashAccountRepository,
                cashTransactionRepository,
                assetPriceDailyRepository,
                portfolioNavDailyRepository,
                fxRateService,
                schedulerProperties
        );

        Long userId = 1L;
        ZoneId zoneId = ZoneId.of("UTC");
        LocalDate navDate = LocalDate.now(zoneId);
        LocalDate previousDate = navDate.minusDays(1);

        Instant previousDayStart = previousDate.atStartOfDay(zoneId).toInstant();
        Instant standardStart = navDate.atStartOfDay(zoneId).toInstant();
        Instant endExclusive = navDate.plusDays(1).atStartOfDay(zoneId).toInstant();

        UserEntity user = mock(UserEntity.class);
        when(user.getId()).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        when(holdingRepository.findActiveHoldingsWithAssetDetailsByUserId(userId)).thenReturn(List.<HoldingEntity>of());

        CashAccountEntity cashAccount = mock(CashAccountEntity.class);
        when(cashAccount.getCurrency()).thenReturn("USD");
        when(cashAccount.getBalance()).thenReturn(BigDecimal.valueOf(1000));
        when(cashAccountRepository.findByUserIdOrderByCurrencyAsc(userId)).thenReturn(List.of(cashAccount));

        PortfolioNavDailyEntity previousSnapshot = mock(PortfolioNavDailyEntity.class);
        when(previousSnapshot.getNavDate()).thenReturn(previousDate);
        when(previousSnapshot.getTotalValue()).thenReturn(BigDecimal.valueOf(32000));
        when(previousSnapshot.getNetValue()).thenReturn(BigDecimal.ONE);
        when(portfolioNavDailyRepository.findTopByUser_IdAndNavDateLessThanOrderByNavDateDesc(userId, navDate))
                .thenReturn(Optional.of(previousSnapshot));
        when(portfolioNavDailyRepository.findByUser_IdAndNavDate(userId, navDate)).thenReturn(Optional.empty());

        CashTransactionEntity previousDayWithdraw = mock(CashTransactionEntity.class);
        when(previousDayWithdraw.getAmount()).thenReturn(BigDecimal.valueOf(-31000));
        when(previousDayWithdraw.getCurrency()).thenReturn("USD");
        when(cashTransactionRepository.findSuccessfulTransactionsInWindow(
                eq(userId),
                anyList(),
                any(Instant.class),
                any(Instant.class)
        )).thenAnswer(invocation -> {
            Instant start = invocation.getArgument(2);
            Instant end = invocation.getArgument(3);
            if (start.equals(standardStart) && end.equals(endExclusive)) {
                return List.<CashTransactionEntity>of();
            }
            if (start.equals(previousDayStart) && end.equals(standardStart)) {
                return List.of(previousDayWithdraw);
            }
            return List.<CashTransactionEntity>of();
        });

        when(fxRateService.reportingCurrency()).thenReturn("USD");
        when(fxRateService.convert(any(BigDecimal.class), eq("USD"), eq("USD")))
                .thenAnswer(invocation -> Optional.of(invocation.getArgument(0)));
        when(schedulerProperties.getZone()).thenReturn("UTC");

        ArgumentCaptor<PortfolioNavDailyEntity> savedCaptor = ArgumentCaptor.forClass(PortfolioNavDailyEntity.class);
        when(portfolioNavDailyRepository.save(savedCaptor.capture()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.buildSnapshotForUser(userId);

        PortfolioNavDailyEntity saved = savedCaptor.getValue();
        assertThat(saved.getDailyReturn()).isNotNull();
        assertThat(saved.getDailyReturn().doubleValue()).isEqualTo(0.0);
        assertThat(saved.getNetValue()).isNotNull();
        assertThat(saved.getNetValue().doubleValue()).isEqualTo(1.0);
    }
}
