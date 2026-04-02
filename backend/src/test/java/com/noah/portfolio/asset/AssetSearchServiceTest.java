package com.noah.portfolio.asset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noah.portfolio.asset.client.EastmoneyClient;
import com.noah.portfolio.asset.client.FinnhubClient;
import com.noah.portfolio.asset.client.YahooFinanceClient;
import com.noah.portfolio.asset.config.FinnhubProperties;
import com.noah.portfolio.asset.client.TwelveDataClient;
import com.noah.portfolio.asset.dto.AssetCandidate;
import com.noah.portfolio.asset.dto.AssetRecommendationResponse;
import com.noah.portfolio.asset.dto.AssetSearchResponse;
import com.noah.portfolio.asset.dto.AssetSuggestionResponse;
import com.noah.portfolio.asset.dto.AssetPriceHistoryItem;
import com.noah.portfolio.asset.dto.AssetPriceHistoryResponse;
import com.noah.portfolio.asset.dto.YahooFinanceDetail;
import com.noah.portfolio.asset.dto.YahooFinanceSearchResult;
import com.noah.portfolio.asset.entity.AssetEntity;
import com.noah.portfolio.asset.entity.AssetStockDetailEntity;
import com.noah.portfolio.asset.model.AssetLatestPriceSnapshot;
import com.noah.portfolio.asset.model.AssetPriceHistoryPoint;
import com.noah.portfolio.asset.model.AssetType;
import com.noah.portfolio.asset.repository.AssetPriceDailyRepository;
import com.noah.portfolio.asset.repository.AssetRepository;
import com.noah.portfolio.asset.repository.AssetSearchDataRepository;
import com.noah.portfolio.asset.service.AssetMetadataEnrichmentService;
import com.noah.portfolio.asset.service.AssetSearchService;

class AssetSearchServiceTest {

    @Test
    void suggestReturnsDatabaseMatchesWithoutCallingYahooFinance() {
        AssetEntity apple = asset(
                1L,
                "AAPL",
                AssetType.STOCK,
                "Apple Inc.",
                "USD",
                "NASDAQ",
                "US",
                false
        );
        AssetEntity applovin = asset(
                2L,
                "APP",
                AssetType.STOCK,
                "AppLovin Corporation",
                "USD",
                "NASDAQ",
                "US",
                false
        );

        StubAssetSearchDataRepository repository = new StubAssetSearchDataRepository(
                List.of(apple, applovin),
                Map.of()
        );
        StubFinnhubClient finnhubClient = new StubFinnhubClient(Optional.empty(), Optional.empty(), List.of());
        AssetSearchService service = new AssetSearchService(
                repository,
                mock(AssetRepository.class),
                mock(AssetPriceDailyRepository.class),
                finnhubClient,
                mock(YahooFinanceClient.class),
                mock(TwelveDataClient.class),
                mock(EastmoneyClient.class),
                mock(AssetMetadataEnrichmentService.class)
        );

        AssetSuggestionResponse response = service.suggest("  App  ", 2);

        assertThat(response.query()).isEqualTo("App");
        assertThat(response.count()).isEqualTo(2);
        assertThat(response.items()).extracting(item -> item.symbol()).containsExactly("AAPL", "APP");
        assertThat(repository.lastSearchQuery).isEqualTo("App");
        assertThat(repository.lastSearchLimit).isEqualTo(2);
        assertThat(finnhubClient.lastSearchQuery).isNull();
        assertThat(finnhubClient.lastFetchSymbol).isNull();
        assertThat(finnhubClient.lastSuggestionQuery).isNull();
    }

    @Test
    void searchUsesDatabaseMatchWithoutCallingExternalDetail() {
        AssetEntity asset = asset(
                1L,
                "AAPL",
                AssetType.STOCK,
                "Apple Inc.",
                "USD",
                "NASDAQ",
                "US",
                false
        );
        AssetStockDetailEntity stockDetail = stockDetail(
                "Technology",
                "Consumer Electronics",
                1_000_000L,
                new BigDecimal("28.50")
        );
        setField(asset, "stockDetail", stockDetail);
        setField(stockDetail, "asset", asset);

        YahooFinanceDetail yahooFinanceDetail = new YahooFinanceDetail(
                "AAPL", "Apple", "Apple Inc.", "EQUITY", "USD", "NasdaqGS", "REGULAR",
                new BigDecimal("191.34"), new BigDecimal("1.22"), new BigDecimal("0.64"),
                2_000_000L, new BigDecimal("29.10"), new BigDecimal("27.40"),
                new BigDecimal("210.00"), new BigDecimal("160.00"), new BigDecimal("0.0045"),
                "https://apple.com", "Technology", "Consumer Electronics", "Summary",
                null, null, null
        );

        StubAssetSearchDataRepository repository = new StubAssetSearchDataRepository(
                List.of(asset),
                Map.of(1L, new AssetLatestPriceSnapshot(1L, new BigDecimal("190.12"), LocalDate.of(2026, 3, 28)))
        );
        StubFinnhubClient finnhubClient = new StubFinnhubClient(Optional.empty(), Optional.of(yahooFinanceDetail), List.of());
        AssetSearchService service = new AssetSearchService(
                repository,
                mock(AssetRepository.class),
                mock(AssetPriceDailyRepository.class),
                finnhubClient,
                mock(YahooFinanceClient.class),
                mock(TwelveDataClient.class),
                mock(EastmoneyClient.class),
                mock(AssetMetadataEnrichmentService.class)
        );

        AssetSearchResponse response = service.search("AAPL");

        assertThat(response.matchedSource()).isEqualTo("DATABASE");
        assertThat(response.resolvedSymbol()).isEqualTo("AAPL");
        assertThat(response.database()).isNotNull();
        assertThat(response.database().symbol()).isEqualTo("AAPL");
        assertThat(response.database().sector()).isEqualTo("Technology");
        assertThat(response.database().latestDbPrice()).isEqualByComparingTo("190.12");
        assertThat(response.yahooFinance()).isNull();
        assertThat(response.databaseMatches()).hasSize(1);
        assertThat(repository.lastSearchQuery).isEqualTo("AAPL");
        assertThat(finnhubClient.lastFetchSymbol).isNull();
    }

    @Test
    void searchFallsBackToYahooFinanceWhenDatabaseReturnsNoMatch() {
        YahooFinanceSearchResult searchResult = new YahooFinanceSearchResult(
                "MSFT", "Microsoft", "Microsoft Corporation", "EQUITY", "NasdaqGS", "US"
        );
        YahooFinanceDetail yahooFinanceDetail = new YahooFinanceDetail(
                "MSFT", "Microsoft", "Microsoft Corporation", "EQUITY", "USD", "NasdaqGS", "REGULAR",
                new BigDecimal("420.00"), new BigDecimal("2.20"), new BigDecimal("0.52"),
                3_000_000L, new BigDecimal("35.10"), new BigDecimal("31.90"),
                new BigDecimal("430.00"), new BigDecimal("300.00"), new BigDecimal("0.0070"),
                "https://microsoft.com", "Technology", "Software", "Summary",
                null, null, null
        );

        StubAssetSearchDataRepository repository = new StubAssetSearchDataRepository(List.of(), Map.of());
        StubFinnhubClient finnhubClient = new StubFinnhubClient(
                Optional.of(searchResult),
                Optional.of(yahooFinanceDetail),
                List.of()
        );
        AssetSearchService service = new AssetSearchService(
                repository,
                mock(AssetRepository.class),
                mock(AssetPriceDailyRepository.class),
                finnhubClient,
                mock(YahooFinanceClient.class),
                mock(TwelveDataClient.class),
                mock(EastmoneyClient.class),
                mock(AssetMetadataEnrichmentService.class)
        );

        AssetSearchResponse response = service.search("microsoft");

        assertThat(response.matchedSource()).isEqualTo("FINNHUB");
        assertThat(response.resolvedSymbol()).isEqualTo("MSFT");
        assertThat(response.database()).isNull();
        assertThat(response.yahooFinance()).isEqualTo(yahooFinanceDetail);
        assertThat(response.warnings()).isNotEmpty();
        assertThat(repository.lastSearchQuery).isEqualTo("microsoft");
        assertThat(finnhubClient.lastSearchQuery).isEqualTo("microsoft");
        assertThat(finnhubClient.lastFetchSymbol).isEqualTo("MSFT");
    }

    @Test
    void suggestUsesRemoteCandidatesOnlyWhenLocalIsEmpty() {
        StubAssetSearchDataRepository repository = new StubAssetSearchDataRepository(List.of(), Map.of());
        StubFinnhubClient finnhubClient = new StubFinnhubClient(
                Optional.empty(),
                Optional.empty(),
                List.of(
                        new YahooFinanceSearchResult("MSFT", "Microsoft", "Microsoft Corporation", "Common Stock", null, null),
                        new YahooFinanceSearchResult("AAPL", "Apple", "Apple Inc.", "Common Stock", null, null)
                )
        );
        AssetSearchService service = new AssetSearchService(
                repository,
                mock(AssetRepository.class),
                mock(AssetPriceDailyRepository.class),
                finnhubClient,
                mock(YahooFinanceClient.class),
                mock(TwelveDataClient.class),
                mock(EastmoneyClient.class),
                mock(AssetMetadataEnrichmentService.class)
        );

        AssetSuggestionResponse response = service.suggest("a", 3);

        assertThat(response.items()).extracting(AssetCandidate::symbol).containsExactly("MSFT", "AAPL");
        assertThat(finnhubClient.lastSuggestionQuery).isEqualTo("a");
        assertThat(finnhubClient.lastSuggestionLimit).isEqualTo(3);
    }

    @Test
    void recommendReturnsScoredAndWeightedCandidates() {
        AssetEntity spx = asset(104L, "SPX", AssetType.INDEX, "S&P 500 Index", "USD", "INDEX", "US", true);
        AssetEntity msft = asset(102L, "MSFT", AssetType.STOCK, "Microsoft Corporation", "USD", "NASDAQ", "US", false);
        AssetEntity nvda = asset(103L, "NVDA", AssetType.STOCK, "NVIDIA Corporation", "USD", "NASDAQ", "US", false);
        setField(msft, "stockDetail", stockDetail("Technology", "Software", 3_000_000_000_000L, new BigDecimal("35.0")));
        setField(nvda, "stockDetail", stockDetail("Technology", "Semiconductors", 2_800_000_000_000L, new BigDecimal("62.0")));

        StubAssetSearchDataRepository repository = new StubAssetSearchDataRepository(
                List.of(),
                Map.of()
        );
        repository.recommendationCandidates = List.of(spx, msft, nvda);
        repository.recentPriceHistory = Map.of(
                104L, history(104L, 100, 100.5, 101.0, 101.2, 101.5),
                102L, history(102L, 100, 102.0, 101.0, 103.0, 104.0),
                103L, history(103L, 100, 106.0, 102.0, 110.0, 115.0)
        );

        AssetSearchService service = new AssetSearchService(
                repository,
                mock(AssetRepository.class),
                mock(AssetPriceDailyRepository.class),
                new StubFinnhubClient(Optional.empty(), Optional.empty(), List.of()),
                mock(YahooFinanceClient.class),
                mock(TwelveDataClient.class),
                mock(EastmoneyClient.class),
                mock(AssetMetadataEnrichmentService.class)
        );

        AssetRecommendationResponse response = service.recommend("conservative", 3, 120);

        assertThat(response.profile()).isEqualTo("conservative");
        assertThat(response.count()).isEqualTo(3);
        assertThat(response.items()).hasSize(3);
        assertThat(response.items()).allSatisfy(item -> {
            assertThat(item.targetWeight()).isGreaterThan(0);
            assertThat(item.reasons()).isNotEmpty();
        });
        assertThat(response.items().get(0).score()).isGreaterThanOrEqualTo(response.items().get(1).score());
        assertThat(response.items().stream().mapToDouble(item -> item.targetWeight()).sum())
                .isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.0001));
        assertThat(response.items()).anyMatch(item -> "SPX".equals(item.symbol()));
    }

    @Test
    void recommendRejectsUnknownProfile() {
        AssetSearchService service = new AssetSearchService(
                new StubAssetSearchDataRepository(List.of(), Map.of()),
                mock(AssetRepository.class),
                mock(AssetPriceDailyRepository.class),
                new StubFinnhubClient(Optional.empty(), Optional.empty(), List.of()),
                mock(YahooFinanceClient.class),
                mock(TwelveDataClient.class),
                mock(EastmoneyClient.class),
                mock(AssetMetadataEnrichmentService.class)
        );

        org.junit.jupiter.api.Assertions.assertThrows(
                ResponseStatusException.class,
                () -> service.recommend("custom", 5, 120)
        );
    }

    @Test
    void priceHistoryCachesRemoteDataWhenLocalAssetDoesNotExist() {
        StubAssetSearchDataRepository repository = new StubAssetSearchDataRepository(List.of(), Map.of());
        AssetRepository assetRepository = mock(AssetRepository.class);
        AssetPriceDailyRepository priceRepository = mock(AssetPriceDailyRepository.class);
        TwelveDataClient twelveDataClient = mock(TwelveDataClient.class);
        EastmoneyClient eastmoneyClient = mock(EastmoneyClient.class);
        YahooFinanceClient yahooFinanceClient = mock(YahooFinanceClient.class);

        AssetEntity cachedAsset = asset(5001L, "SPX", AssetType.INDEX, "SPX", "USD", "INDEX", "US", true);
        when(assetRepository.findFirstBySymbolIgnoreCaseOrderByIdAsc("SPX")).thenReturn(Optional.empty());
        when(assetRepository.findMaxId()).thenReturn(5000L);
        when(assetRepository.saveAndFlush(any(AssetEntity.class))).thenReturn(cachedAsset);

        when(eastmoneyClient.supportsSymbol("SPX")).thenReturn(false);
        when(twelveDataClient.fetchDailyHistory(any(), any(), any())).thenReturn(List.of(
                new AssetPriceHistoryItem(LocalDate.of(2026, 3, 28), new BigDecimal("5700.11")),
                new AssetPriceHistoryItem(LocalDate.of(2026, 3, 31), new BigDecimal("5758.32"))
        ));

        when(priceRepository.findTradeDates(anyLong(), any(), any())).thenReturn(List.of());
        when(priceRepository.countOhlcColumns()).thenReturn(0L);
        when(priceRepository.findPriceHistory(anyLong(), any(), any())).thenReturn(List.of(
                new AssetPriceHistoryPoint(5001L, new BigDecimal("5700.11"), LocalDate.of(2026, 3, 28)),
                new AssetPriceHistoryPoint(5001L, new BigDecimal("5758.32"), LocalDate.of(2026, 3, 31))
        ));

        AssetSearchService service = new AssetSearchService(
                repository,
                assetRepository,
                priceRepository,
                new StubFinnhubClient(Optional.empty(), Optional.empty(), List.of()),
                yahooFinanceClient,
                twelveDataClient,
                eastmoneyClient,
                mock(AssetMetadataEnrichmentService.class)
        );

        AssetPriceHistoryResponse response = service.priceHistory("SPX", 30);

        assertThat(response.source()).isEqualTo("DATABASE");
        assertThat(response.count()).isGreaterThanOrEqualTo(1);
        verify(yahooFinanceClient, never()).fetchDailyHistory(any(), any(), any());
    }

    @Test
    void priceHistoryFallsBackToFinnhubAfterYahooWhenTwelveDataReturnsEmpty() {
        StubAssetSearchDataRepository repository = new StubAssetSearchDataRepository(List.of(), Map.of());
        AssetRepository assetRepository = mock(AssetRepository.class);
        AssetPriceDailyRepository priceRepository = mock(AssetPriceDailyRepository.class);
        TwelveDataClient twelveDataClient = mock(TwelveDataClient.class);
        FinnhubClient finnhubClient = mock(FinnhubClient.class);
        EastmoneyClient eastmoneyClient = mock(EastmoneyClient.class);
        YahooFinanceClient yahooFinanceClient = mock(YahooFinanceClient.class);

        AssetEntity cachedAsset = asset(5001L, "SPX", AssetType.INDEX, "SPX", "USD", "INDEX", "US", true);
        when(assetRepository.findFirstBySymbolIgnoreCaseOrderByIdAsc("SPX")).thenReturn(Optional.of(cachedAsset));

        when(eastmoneyClient.supportsSymbol("SPX")).thenReturn(false);
        when(twelveDataClient.fetchDailyHistory(any(), any(), any())).thenReturn(List.of());
        when(yahooFinanceClient.fetchDailyHistory(any(), any(), any())).thenReturn(List.of());
        when(finnhubClient.fetchDailyHistory(any(), any(), any())).thenReturn(List.of(
                new AssetPriceHistoryItem(LocalDate.of(2026, 3, 28), new BigDecimal("5700.11")),
                new AssetPriceHistoryItem(LocalDate.of(2026, 3, 31), new BigDecimal("5758.32"))
        ));

        when(priceRepository.findTradeDates(anyLong(), any(), any())).thenReturn(List.of());
        when(priceRepository.countOhlcColumns()).thenReturn(0L);
        when(priceRepository.findPriceHistory(anyLong(), any(), any())).thenReturn(List.of(
                new AssetPriceHistoryPoint(5001L, new BigDecimal("5700.11"), LocalDate.of(2026, 3, 28)),
                new AssetPriceHistoryPoint(5001L, new BigDecimal("5758.32"), LocalDate.of(2026, 3, 31))
        ));

        AssetSearchService service = new AssetSearchService(
                repository,
                assetRepository,
                priceRepository,
                finnhubClient,
                yahooFinanceClient,
                twelveDataClient,
                eastmoneyClient,
                mock(AssetMetadataEnrichmentService.class)
        );

        AssetPriceHistoryResponse response = service.priceHistory("SPX", 30);

        assertThat(response.source()).isEqualTo("DATABASE");
        assertThat(response.count()).isGreaterThanOrEqualTo(1);
        verify(twelveDataClient).fetchDailyHistory(any(), any(), any());
        verify(yahooFinanceClient).fetchDailyHistory(any(), any(), any());
        verify(finnhubClient).fetchDailyHistory(any(), any(), any());
    }

    private AssetEntity asset(
            Long id,
            String symbol,
            AssetType assetType,
            String name,
            String currency,
            String exchange,
            String region,
            boolean benchmark
    ) {
        AssetEntity asset = newInstance(AssetEntity.class);
        setField(asset, "id", id);
        setField(asset, "symbol", symbol);
        setField(asset, "assetType", assetType);
        setField(asset, "name", name);
        setField(asset, "currency", currency);
        setField(asset, "exchange", exchange);
        setField(asset, "region", region);
        setField(asset, "benchmark", benchmark);
        return asset;
    }

    private AssetStockDetailEntity stockDetail(
            String sector,
            String industry,
            Long marketCap,
            BigDecimal peRatio
    ) {
        AssetStockDetailEntity detail = newInstance(AssetStockDetailEntity.class);
        setField(detail, "sector", sector);
        setField(detail, "industry", industry);
        setField(detail, "marketCap", marketCap);
        setField(detail, "peRatio", peRatio);
        return detail;
    }

    private List<AssetPriceHistoryPoint> history(Long assetId, double... closes) {
        List<AssetPriceHistoryPoint> points = new ArrayList<>();
        LocalDate start = LocalDate.of(2026, 3, 25);
        for (int i = 0; i < closes.length; i += 1) {
            points.add(new AssetPriceHistoryPoint(
                    assetId,
                    BigDecimal.valueOf(closes[i]),
                    start.plusDays(i)
            ));
        }
        return points;
    }

    private <T> T newInstance(Class<T> type) {
        try {
            var constructor = type.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (NoSuchMethodException | InstantiationException | IllegalAccessException | InvocationTargetException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static final class StubAssetSearchDataRepository implements AssetSearchDataRepository {
        private final List<AssetEntity> assets;
        private final Map<Long, AssetLatestPriceSnapshot> latestPriceSnapshots;
        private List<AssetEntity> recommendationCandidates = List.of();
        private Map<Long, List<AssetPriceHistoryPoint>> recentPriceHistory = Map.of();
        private String lastSearchQuery;
        private Integer lastSearchLimit;

        private StubAssetSearchDataRepository(
                List<AssetEntity> assets,
                Map<Long, AssetLatestPriceSnapshot> latestPriceSnapshots
        ) {
            this.assets = assets;
            this.latestPriceSnapshots = latestPriceSnapshots;
        }

        @Override
        public List<AssetEntity> searchAssets(String query, int limit) {
            this.lastSearchQuery = query;
            this.lastSearchLimit = limit;
            return assets;
        }

        @Override
        public Map<Long, AssetLatestPriceSnapshot> findLatestPriceSnapshots(List<Long> assetIds) {
            return latestPriceSnapshots;
        }

        @Override
        public List<AssetEntity> listRecommendationCandidates(int limit) {
            if (recommendationCandidates.isEmpty()) {
                return List.of();
            }
            return recommendationCandidates.stream().limit(limit).toList();
        }

        @Override
        public Map<Long, List<AssetPriceHistoryPoint>> findRecentPriceHistory(List<Long> assetIds, LocalDate startDate) {
            return recentPriceHistory;
        }
    }

    private static final class StubFinnhubClient extends FinnhubClient {
        private final Optional<YahooFinanceSearchResult> searchResult;
        private final Optional<YahooFinanceDetail> detailResult;
        private final List<YahooFinanceSearchResult> suggestionResults;
        private String lastSearchQuery;
        private String lastFetchSymbol;
        private String lastSuggestionQuery;
        private Integer lastSuggestionLimit;

        private StubFinnhubClient(
                Optional<YahooFinanceSearchResult> searchResult,
                Optional<YahooFinanceDetail> detailResult,
                List<YahooFinanceSearchResult> suggestionResults
        ) {
            super(RestClient.builder(), new ObjectMapper(), new FinnhubProperties());
            this.searchResult = searchResult;
            this.detailResult = detailResult;
            this.suggestionResults = suggestionResults;
        }

        @Override
        public Optional<YahooFinanceSearchResult> searchBestMatch(String query) {
            this.lastSearchQuery = query;
            return searchResult;
        }

        @Override
        public Optional<YahooFinanceDetail> fetchDetail(String symbol) {
            this.lastFetchSymbol = symbol;
            return detailResult;
        }

        @Override
        public List<YahooFinanceSearchResult> searchCandidates(String query, int limit) {
            this.lastSuggestionQuery = query;
            this.lastSuggestionLimit = limit;
            return new ArrayList<>(suggestionResults);
        }
    }
}
