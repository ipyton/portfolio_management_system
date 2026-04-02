package com.noah.portfolio.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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
import com.noah.portfolio.asset.entity.AssetEntity;
import com.noah.portfolio.asset.model.AssetType;
import com.noah.portfolio.asset.repository.AssetPriceDailyRepository;
import com.noah.portfolio.asset.service.AssetMetadataEnrichmentService;
import com.noah.portfolio.fx.service.FxRateService;
import com.noah.portfolio.scheduler.service.PortfolioNavSnapshotService;
import com.noah.portfolio.trading.repository.CashAccountRepository;
import com.noah.portfolio.trading.entity.HoldingEntity;
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
        List<HoldingEntity> holdings = List.of(
                holding(1001L, "AAPL", "Apple", "US", "NASDAQ", "USD", 10.0, 100.0)
        );
        List<AssetPriceDailyRepository.AssetLatestPriceView> latestPrices = List.of(
                latestPrice(1001L, LocalDate.of(2026, 1, 5), 166.65)
        );

        when(userRepository.existsById(1L)).thenReturn(true);
        when(portfolioNavDailyRepository.findByUser_IdOrderByNavDateAsc(1L)).thenReturn(navSeries);
        when(holdingRepository.findActiveHoldingsWithAssetDetailsByUserId(1L)).thenReturn(holdings);
        when(cashAccountRepository.findByUserIdOrderByCurrencyAsc(1L)).thenReturn(List.of());
        when(tradeHistoryRepository.findDetailedTradeHistoryByUserId(1L)).thenReturn(List.of());
        when(assetPriceDailyRepository.findLatestPriceViewsByAssetIdIn(any())).thenReturn(latestPrices);
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
        assertThat(spx.get("beta")).isNull();
        assertThat(spx.get("alpha")).isNull();
        assertThat(((Double) spx.get("excessReturn"))).isCloseTo(0.0, within(1e-6));
    }

    @Test
    void dashboardNormalizesHoldingRegionBeforeDominantRegionAndBenchmarkSelection() {
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
                nav(LocalDate.of(2026, 1, 2), 101.0, 0.01)
        );
        List<AssetPriceDailyRepository.BenchmarkPriceView> benchmarkSeries = List.of(
                benchmark("000300.SH", LocalDate.of(2026, 1, 1), 4000.0, "Asia/Shanghai"),
                benchmark("000300.SH", LocalDate.of(2026, 1, 2), 4040.0, "Asia/Shanghai"),
                benchmark("SPX", LocalDate.of(2026, 1, 1), 5000.0, "US"),
                benchmark("SPX", LocalDate.of(2026, 1, 2), 5050.0, "US")
        );
        List<HoldingEntity> holdings = List.of(
                holding(101L, "TESTCN", "China A", "Asia/Shanghai", "UNKNOWN", "USD", 10.0, 5.0)
        );
        List<AssetPriceDailyRepository.AssetLatestPriceView> latestPrices = List.of(
                latestPrice(101L, LocalDate.of(2026, 1, 2), 9.0)
        );

        when(userRepository.existsById(1L)).thenReturn(true);
        when(portfolioNavDailyRepository.findByUser_IdOrderByNavDateAsc(1L)).thenReturn(navSeries);
        when(holdingRepository.findActiveHoldingsWithAssetDetailsByUserId(1L)).thenReturn(holdings);
        when(cashAccountRepository.findByUserIdOrderByCurrencyAsc(1L)).thenReturn(List.of());
        when(tradeHistoryRepository.findDetailedTradeHistoryByUserId(1L)).thenReturn(List.of());
        when(assetPriceDailyRepository.findLatestPriceViewsByAssetIdIn(any())).thenReturn(latestPrices);
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

        Map<String, Object> response = service.getDashboardSummary(1L, null, "USD");
        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) response.get("meta");
        @SuppressWarnings("unchecked")
        Map<String, Object> risk = (Map<String, Object>) response.get("risk");
        @SuppressWarnings("unchecked")
        Map<String, Object> holdingsSection = (Map<String, Object>) response.get("holdings");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> regionDistribution = (List<Map<String, Object>>) holdingsSection.get("regionDistribution");

        assertThat(meta.get("dominantRegion")).isEqualTo("CN");
        assertThat(risk.get("benchmarkSymbol")).isEqualTo("000300.SH");
        assertThat(regionDistribution).isNotEmpty();
        assertThat(regionDistribution.get(0).get("name")).isEqualTo("CN");
        verify(systemConfigRepository).findByConfigKey("risk_free_rate_CNY");
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
        return benchmark(symbol, date, close, "US");
    }

    private AssetPriceDailyRepository.BenchmarkPriceView benchmark(String symbol, LocalDate date, double close, String region) {
        AssetPriceDailyRepository.BenchmarkPriceView view = mock(AssetPriceDailyRepository.BenchmarkPriceView.class);
        when(view.getSymbol()).thenReturn(symbol);
        when(view.getName()).thenReturn(symbol);
        when(view.getRegion()).thenReturn(region);
        when(view.getTradeDate()).thenReturn(date);
        when(view.getClose()).thenReturn(BigDecimal.valueOf(close));
        return view;
    }

    private HoldingEntity holding(
            Long assetId,
            String symbol,
            String name,
            String region,
            String exchange,
            String currency,
            double quantity,
            double avgCost
    ) {
        HoldingEntity holding = mock(HoldingEntity.class);
        AssetEntity asset = mock(AssetEntity.class);

        when(holding.getAsset()).thenReturn(asset);
        when(holding.getQuantity()).thenReturn(BigDecimal.valueOf(quantity));
        when(holding.getAvgCost()).thenReturn(BigDecimal.valueOf(avgCost));

        when(asset.getId()).thenReturn(assetId);
        when(asset.getSymbol()).thenReturn(symbol);
        when(asset.getName()).thenReturn(name);
        when(asset.getRegion()).thenReturn(region);
        when(asset.getExchange()).thenReturn(exchange);
        when(asset.getCurrency()).thenReturn(currency);
        when(asset.getAssetType()).thenReturn(AssetType.STOCK);
        when(asset.getStockDetail()).thenReturn(null);
        return holding;
    }

    private AssetPriceDailyRepository.AssetLatestPriceView latestPrice(Long assetId, LocalDate date, double close) {
        AssetPriceDailyRepository.AssetLatestPriceView view = mock(AssetPriceDailyRepository.AssetLatestPriceView.class);
        when(view.getAssetId()).thenReturn(assetId);
        when(view.getTradeDate()).thenReturn(date);
        when(view.getClose()).thenReturn(BigDecimal.valueOf(close));
        return view;
    }
}
