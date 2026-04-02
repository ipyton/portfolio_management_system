package com.noah.portfolio.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.noah.portfolio.analytics.entity.PortfolioNavDailyEntity;
import com.noah.portfolio.analytics.repository.PortfolioNavDailyRepository;
import com.noah.portfolio.analytics.repository.SystemConfigRepository;
import com.noah.portfolio.analytics.service.PortfolioAnalyticsService;
import com.noah.portfolio.asset.client.FinnhubClient;
import com.noah.portfolio.asset.repository.AssetPriceDailyRepository;
import com.noah.portfolio.asset.service.AssetMetadataEnrichmentService;
import com.noah.portfolio.fx.service.FxRateService;
import com.noah.portfolio.scheduler.service.PortfolioNavSnapshotService;
import com.noah.portfolio.trading.repository.CashAccountRepository;
import com.noah.portfolio.trading.repository.HoldingRepository;
import com.noah.portfolio.trading.repository.TradeHistoryRepository;
import com.noah.portfolio.user.repository.UserRepository;

class PortfolioAnalyticsServiceAlignmentTest {

    @Test
    void benchmarkComparisonUsesOverlappedSamplesForAlphaBetaAndExcessReturn() {
        UserRepository userRepository = mock(UserRepository.class);
        PortfolioNavDailyRepository portfolioNavDailyRepository = mock(PortfolioNavDailyRepository.class);
        HoldingRepository holdingRepository = mock(HoldingRepository.class);
        CashAccountRepository cashAccountRepository = mock(CashAccountRepository.class);
        TradeHistoryRepository tradeHistoryRepository = mock(TradeHistoryRepository.class);
        AssetPriceDailyRepository assetPriceDailyRepository = mock(AssetPriceDailyRepository.class);
        SystemConfigRepository systemConfigRepository = mock(SystemConfigRepository.class);
        FxRateService fxRateService = mock(FxRateService.class);
        FinnhubClient finnhubClient = mock(FinnhubClient.class);
        PortfolioNavSnapshotService portfolioNavSnapshotService = mock(PortfolioNavSnapshotService.class);
        AssetMetadataEnrichmentService assetMetadataEnrichmentService = mock(AssetMetadataEnrichmentService.class);

        List<PortfolioNavDailyEntity> navSeries = List.of(
                nav(LocalDate.of(2026, 1, 1), 100.0, null),
                nav(LocalDate.of(2026, 1, 3), 101.0, 0.01),
                nav(LocalDate.of(2026, 1, 4), 111.1, 0.1),
                nav(LocalDate.of(2026, 1, 5), 166.65, 0.5)
        );
        List<AssetPriceDailyRepository.BenchmarkPriceView> benchmarkSeries = List.of(
                benchmark("SPX", LocalDate.of(2026, 1, 1), 100.0),
                benchmark("SPX", LocalDate.of(2026, 1, 2), 110.0),
                benchmark("SPX", LocalDate.of(2026, 1, 3), 111.1),
                benchmark("SPX", LocalDate.of(2026, 1, 4), 122.21)
        );

        when(userRepository.existsById(1L)).thenReturn(true);
        when(portfolioNavDailyRepository.findByUser_IdOrderByNavDateAsc(1L)).thenReturn(navSeries);
        when(holdingRepository.findActiveHoldingsWithAssetDetailsByUserId(1L)).thenReturn(List.of());
        when(cashAccountRepository.findByUserIdOrderByCurrencyAsc(1L)).thenReturn(List.of());
        when(tradeHistoryRepository.findDetailedTradeHistoryByUserId(1L)).thenReturn(List.of());
        when(assetPriceDailyRepository.findBenchmarkPriceSeries(any(LocalDate.class), any(LocalDate.class))).thenReturn(benchmarkSeries);
        when(systemConfigRepository.findByConfigKey(anyString())).thenReturn(Optional.empty());
        when(fxRateService.reportingCurrency()).thenReturn("USD");
        when(fxRateService.convert(any(BigDecimal.class), anyString(), anyString()))
                .thenAnswer(invocation -> Optional.of(invocation.getArgument(0)));
        when(fxRateService.getConversionRate(anyString(), anyString())).thenReturn(Optional.of(BigDecimal.ONE));
        when(fxRateService.latestAsOf()).thenReturn(Instant.parse("2026-01-06T00:00:00Z"));
        when(fxRateService.isStale(any(Instant.class))).thenReturn(false);

        PortfolioAnalyticsService service = new PortfolioAnalyticsService(
                userRepository,
                portfolioNavDailyRepository,
                holdingRepository,
                cashAccountRepository,
                tradeHistoryRepository,
                assetPriceDailyRepository,
                systemConfigRepository,
                fxRateService,
                finnhubClient,
                portfolioNavSnapshotService,
                assetMetadataEnrichmentService
        );

        Map<String, Object> response = service.getDashboardSummary(1L, "SPX", "USD");
        @SuppressWarnings("unchecked")
        Map<String, Object> performance = (Map<String, Object>) response.get("performance");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> comparisons = (List<Map<String, Object>>) performance.get("benchmarkComparisons");
        Map<String, Object> spx = comparisons.get(0);

        assertThat(spx.get("symbol")).isEqualTo("SPX");
        assertThat(spx.get("observationCount")).isEqualTo(2);
        assertThat(((Double) spx.get("beta"))).isCloseTo(1.0, within(1e-6));
        assertThat(((Double) spx.get("alpha"))).isCloseTo(0.0, within(1e-6));
        assertThat(((Double) spx.get("excessReturn"))).isCloseTo(0.0, within(1e-6));
    }

    private PortfolioNavDailyEntity nav(LocalDate date, double totalValue, Double dailyReturn) {
        PortfolioNavDailyEntity entity = mock(PortfolioNavDailyEntity.class);
        when(entity.getNavDate()).thenReturn(date);
        when(entity.getTotalValue()).thenReturn(BigDecimal.valueOf(totalValue));
        when(entity.getHoldingValue()).thenReturn(BigDecimal.ZERO);
        when(entity.getCash()).thenReturn(BigDecimal.valueOf(totalValue));
        when(entity.getNetValue()).thenReturn(BigDecimal.valueOf(totalValue));
        when(entity.getDailyReturn()).thenReturn(dailyReturn == null ? null : BigDecimal.valueOf(dailyReturn));
        return entity;
    }

    private AssetPriceDailyRepository.BenchmarkPriceView benchmark(String symbol, LocalDate date, double close) {
        AssetPriceDailyRepository.BenchmarkPriceView view = mock(AssetPriceDailyRepository.BenchmarkPriceView.class);
        when(view.getSymbol()).thenReturn(symbol);
        when(view.getName()).thenReturn(symbol);
        when(view.getRegion()).thenReturn("US");
        when(view.getTradeDate()).thenReturn(date);
        when(view.getClose()).thenReturn(BigDecimal.valueOf(close));
        return view;
    }
}
