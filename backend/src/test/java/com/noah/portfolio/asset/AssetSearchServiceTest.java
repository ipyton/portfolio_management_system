package com.noah.portfolio.asset;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noah.portfolio.asset.client.YahooFinanceClient;
import com.noah.portfolio.asset.config.YahooFinanceProperties;
import com.noah.portfolio.asset.dto.AssetSearchResponse;
import com.noah.portfolio.asset.dto.AssetSuggestionResponse;
import com.noah.portfolio.asset.dto.YahooFinanceDetail;
import com.noah.portfolio.asset.dto.YahooFinanceSearchResult;
import com.noah.portfolio.asset.entity.AssetEntity;
import com.noah.portfolio.asset.entity.AssetStockDetailEntity;
import com.noah.portfolio.asset.model.AssetLatestPriceSnapshot;
import com.noah.portfolio.asset.model.AssetType;
import com.noah.portfolio.asset.repository.AssetSearchDataRepository;
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
        StubYahooFinanceClient yahooFinanceClient = new StubYahooFinanceClient(Optional.empty(), Optional.empty());
        AssetSearchService service = new AssetSearchService(repository, yahooFinanceClient);

        AssetSuggestionResponse response = service.suggest("  App  ", 2);

        assertThat(response.query()).isEqualTo("App");
        assertThat(response.count()).isEqualTo(2);
        assertThat(response.items()).extracting(item -> item.symbol()).containsExactly("AAPL", "APP");
        assertThat(repository.lastSearchQuery).isEqualTo("App");
        assertThat(repository.lastSearchLimit).isEqualTo(2);
        assertThat(yahooFinanceClient.lastSearchQuery).isNull();
        assertThat(yahooFinanceClient.lastFetchSymbol).isNull();
    }

    @Test
    void searchUsesDatabaseMatchAndFetchesYahooDetailByDatabaseSymbol() {
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
        StubYahooFinanceClient yahooFinanceClient = new StubYahooFinanceClient(
                Optional.empty(),
                Optional.of(yahooFinanceDetail)
        );
        AssetSearchService service = new AssetSearchService(repository, yahooFinanceClient);

        AssetSearchResponse response = service.search("AAPL");

        assertThat(response.matchedSource()).isEqualTo("DATABASE");
        assertThat(response.resolvedSymbol()).isEqualTo("AAPL");
        assertThat(response.database()).isNotNull();
        assertThat(response.database().symbol()).isEqualTo("AAPL");
        assertThat(response.database().sector()).isEqualTo("Technology");
        assertThat(response.database().latestDbPrice()).isEqualByComparingTo("190.12");
        assertThat(response.yahooFinance()).isEqualTo(yahooFinanceDetail);
        assertThat(response.databaseMatches()).hasSize(1);
        assertThat(repository.lastSearchQuery).isEqualTo("AAPL");
        assertThat(yahooFinanceClient.lastFetchSymbol).isEqualTo("AAPL");
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
        StubYahooFinanceClient yahooFinanceClient = new StubYahooFinanceClient(
                Optional.of(searchResult),
                Optional.of(yahooFinanceDetail)
        );
        AssetSearchService service = new AssetSearchService(repository, yahooFinanceClient);

        AssetSearchResponse response = service.search("microsoft");

        assertThat(response.matchedSource()).isEqualTo("YAHOO_FINANCE");
        assertThat(response.resolvedSymbol()).isEqualTo("MSFT");
        assertThat(response.database()).isNull();
        assertThat(response.yahooFinance()).isEqualTo(yahooFinanceDetail);
        assertThat(response.warnings()).isNotEmpty();
        assertThat(repository.lastSearchQuery).isEqualTo("microsoft");
        assertThat(yahooFinanceClient.lastSearchQuery).isEqualTo("microsoft");
        assertThat(yahooFinanceClient.lastFetchSymbol).isEqualTo("MSFT");
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
    }

    private static final class StubYahooFinanceClient extends YahooFinanceClient {
        private final Optional<YahooFinanceSearchResult> searchResult;
        private final Optional<YahooFinanceDetail> detailResult;
        private String lastSearchQuery;
        private String lastFetchSymbol;

        private StubYahooFinanceClient(
                Optional<YahooFinanceSearchResult> searchResult,
                Optional<YahooFinanceDetail> detailResult
        ) {
            super(RestClient.builder(), new ObjectMapper(), new YahooFinanceProperties());
            this.searchResult = searchResult;
            this.detailResult = detailResult;
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
    }
}
