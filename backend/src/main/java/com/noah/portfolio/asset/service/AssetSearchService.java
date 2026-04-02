package com.noah.portfolio.asset.service;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.common.RegionCodeNormalizer;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class AssetSearchService {

    private static final int SEARCH_LIMIT = 5;
    private static final int DEFAULT_SUGGESTION_LIMIT = 8;
    private static final int MAX_SUGGESTION_LIMIT = 20;
    private static final int DEFAULT_HISTORY_DAYS = 30;
    private static final int MAX_HISTORY_DAYS = 365;
    private static final int DEFAULT_RECOMMENDATION_LIMIT = 6;
    private static final int MAX_RECOMMENDATION_LIMIT = 12;
    private static final int DEFAULT_RECOMMENDATION_LOOKBACK_DAYS = 180;
    private static final int MIN_RECOMMENDATION_LOOKBACK_DAYS = 30;
    private static final int MAX_ASSET_CREATE_RETRIES = 8;
    private static final String DEFAULT_CANDLE_INTERVAL = "1day";
    private static final Set<String> SUPPORTED_CANDLE_INTERVALS = Set.of("1h", "1day", "1week", "1month");
    private static final Set<String> KNOWN_INDEX_SYMBOLS = Set.of(
            "SPX", "IXIC", "DJI", "FTSE", "GDAXI", "FCHI", "N225", "HSI", "SSEC", "BSESN", "NSEI", "AXJO", "KS11", "TSX", "000300.SH"
    );

    private final AssetSearchDataRepository assetSearchDataRepository;
    private final AssetRepository assetRepository;
    private final AssetPriceDailyRepository assetPriceDailyRepository;
    private final AssetCandleCacheRepository assetCandleCacheRepository;
    private final FinnhubClient finnhubClient;
    private final YahooFinanceClient yahooFinanceClient;
    private final TwelveDataClient twelveDataClient;
    private final EastmoneyClient eastmoneyClient;
    private final AssetMetadataEnrichmentService assetMetadataEnrichmentService;
    @PersistenceContext
    private EntityManager entityManager;

    public AssetSearchService(
            AssetSearchDataRepository assetSearchDataRepository,
            AssetRepository assetRepository,
            AssetPriceDailyRepository assetPriceDailyRepository,
            AssetCandleCacheRepository assetCandleCacheRepository,
            FinnhubClient finnhubClient,
            YahooFinanceClient yahooFinanceClient,
            TwelveDataClient twelveDataClient,
            EastmoneyClient eastmoneyClient,
            AssetMetadataEnrichmentService assetMetadataEnrichmentService
    ) {
        this.assetSearchDataRepository = assetSearchDataRepository;
        this.assetRepository = assetRepository;
        this.assetPriceDailyRepository = assetPriceDailyRepository;
        this.assetCandleCacheRepository = assetCandleCacheRepository;
        this.finnhubClient = finnhubClient;
        this.yahooFinanceClient = yahooFinanceClient;
        this.twelveDataClient = twelveDataClient;
        this.eastmoneyClient = eastmoneyClient;
        this.assetMetadataEnrichmentService = assetMetadataEnrichmentService;
    }

    public AssetSearchResponse search(String query) {
        String normalizedQuery = normalizeQuery(query);
        List<AssetEntity> matchedAssets = assetSearchDataRepository.searchAssets(normalizedQuery, SEARCH_LIMIT);
        Map<Long, AssetLatestPriceSnapshot> latestPrices = assetSearchDataRepository.findLatestPriceSnapshots(
                matchedAssets.stream().map(AssetEntity::getId).toList()
        );

        List<DatabaseAssetDetail> databaseMatches = buildDatabaseMatches(matchedAssets, latestPrices);
        DatabaseAssetDetail primaryDatabaseMatch = databaseMatches.isEmpty() ? null : databaseMatches.get(0);
        List<String> warnings = new ArrayList<>();

        if (shouldEnrichStockMetadata(primaryDatabaseMatch)
                && assetMetadataEnrichmentService.enrichStockMetadataBySymbol(primaryDatabaseMatch.symbol())) {
            matchedAssets = assetSearchDataRepository.searchAssets(normalizedQuery, SEARCH_LIMIT);
            latestPrices = assetSearchDataRepository.findLatestPriceSnapshots(
                    matchedAssets.stream().map(AssetEntity::getId).toList()
            );
            databaseMatches = buildDatabaseMatches(matchedAssets, latestPrices);
            primaryDatabaseMatch = databaseMatches.isEmpty() ? null : databaseMatches.get(0);
        }

        String matchedSource;
        String resolvedSymbol;
        YahooFinanceDetail yahooFinanceDetail = null;
        if (primaryDatabaseMatch != null) {
            matchedSource = "DATABASE";
            resolvedSymbol = primaryDatabaseMatch.symbol();
            // Database-first mode: when local data exists, skip external quote lookup.
            return new AssetSearchResponse(
                    normalizedQuery,
                    matchedSource,
                    resolvedSymbol,
                    primaryDatabaseMatch,
                    null,
                    databaseMatches.stream().map(this::toCandidate).toList(),
                    warnings
            );
        } else {
            YahooFinanceSearchResult finnhubSearchResult = null;
            try {
                finnhubSearchResult = finnhubClient.searchBestMatch(normalizedQuery)
                        .orElse(null);
            } catch (FinnhubClient.FinnhubLookupException ex) {
                warnings.add("No local asset matched the query, and Finnhub search is currently unavailable.");
            }

            if (finnhubSearchResult == null) {
                matchedSource = "UNAVAILABLE";
                resolvedSymbol = normalizedQuery.toUpperCase(Locale.ROOT);
                warnings.add("No local asset matched the query.");
                return new AssetSearchResponse(
                        normalizedQuery,
                        matchedSource,
                        resolvedSymbol,
                        null,
                        null,
                        List.of(),
                        warnings
                );
            }

            matchedSource = "FINNHUB";
            resolvedSymbol = finnhubSearchResult.symbol();
            warnings.add("No local asset matched the query. The symbol was resolved through Finnhub search.");
        }

        try {
            yahooFinanceDetail = finnhubClient.fetchDetail(resolvedSymbol).orElse(null);
            if (yahooFinanceDetail == null) {
                warnings.add("Finnhub did not return quote detail for symbol " + resolvedSymbol + ".");
            }
        } catch (FinnhubClient.FinnhubLookupException ex) {
            warnings.add("Finnhub detail lookup failed. Returning available local result only.");
        }

        return new AssetSearchResponse(
                normalizedQuery,
                matchedSource,
                resolvedSymbol,
                primaryDatabaseMatch,
                yahooFinanceDetail,
                databaseMatches.stream().map(this::toCandidate).toList(),
                warnings
        );
    }

    public AssetWorldIndicesResponse worldIndices() {
        List<AssetEntity> indices = assetRepository.findBenchmarkIndices();
        if (indices.isEmpty()) {
            indices = assetRepository.findAllByAssetTypeOrderBySymbolAsc(AssetType.INDEX);
        }

        Map<Long, AssetPriceWindowSnapshot> latestWindows = assetSearchDataRepository.findLatestPriceWindows(
                indices.stream().map(AssetEntity::getId).toList()
        );

        List<AssetWorldIndexItem> items = indices.stream()
                .map(asset -> {
                    AssetPriceWindowSnapshot latest = latestWindows.get(asset.getId());
                    return new AssetWorldIndexItem(
                            asset.getSymbol(),
                            asset.getName(),
                            normalizeRegion(asset.getRegion(), asset.getSymbol()),
                            asset.getExchange(),
                            asset.getCurrency(),
                            latest == null ? null : latest.latestTradeDate(),
                            latest == null ? null : latest.latestClose(),
                            latest == null ? null : latest.previousClose(),
                            asset.getLastPriceRefreshedAt()
                    );
                })
                .toList();
        return new AssetWorldIndicesResponse(items.size(), items);
    }

    public AssetSuggestionResponse suggest(String query, Integer limit) {
        String normalizedQuery = normalizeQuery(query);
        int normalizedLimit = normalizeSuggestionLimit(limit);
        List<AssetCandidate> localSuggestions = assetSearchDataRepository.searchAssets(normalizedQuery, normalizedLimit).stream()
                .map(this::toCandidate)
                .toList();

        LinkedHashMap<String, AssetCandidate> merged = new LinkedHashMap<>();
        for (AssetCandidate local : localSuggestions) {
            if (merged.size() >= normalizedLimit) {
                break;
            }
            merged.putIfAbsent(local.symbol().toUpperCase(Locale.ROOT), local);
        }

        if (merged.isEmpty()) {
            int remaining = normalizedLimit - merged.size();
            try {
                List<YahooFinanceSearchResult> remoteSuggestions = finnhubClient.searchCandidates(
                        normalizedQuery,
                        Math.max(remaining, 3)
                );
                for (YahooFinanceSearchResult remote : remoteSuggestions) {
                    if (merged.size() >= normalizedLimit) {
                        break;
                    }
                    AssetCandidate candidate = toCandidate(remote);
                    merged.putIfAbsent(candidate.symbol().toUpperCase(Locale.ROOT), candidate);
                }
            } catch (FinnhubClient.FinnhubLookupException ignored) {
                // Suggestions endpoint should stay available even when external quote provider is unavailable.
            }
        }

        List<AssetCandidate> suggestions = new ArrayList<>(merged.values());
        return new AssetSuggestionResponse(normalizedQuery, suggestions.size(), suggestions);
    }

    public AssetRecommendationResponse recommend(String profile, Integer limit, Integer lookbackDays) {
        RecommendationProfile normalizedProfile = RecommendationProfile.parse(profile);
        int normalizedLimit = normalizeRecommendationLimit(limit);
        int normalizedLookbackDays = normalizeRecommendationLookbackDays(lookbackDays);
        int candidateLimit = Math.max(normalizedLimit * 3, 12);

        List<AssetEntity> candidates = assetSearchDataRepository.listRecommendationCandidates(candidateLimit);
        List<String> warnings = new ArrayList<>();
        if (candidates.isEmpty()) {
            warnings.add("No local assets available to build recommendations.");
            return new AssetRecommendationResponse(normalizedProfile.id, 0, List.of(), warnings);
        }

        LocalDate startDate = LocalDate.now().minusDays(normalizedLookbackDays - 1L);
        Map<Long, List<AssetPriceHistoryPoint>> historyByAsset = assetSearchDataRepository.findRecentPriceHistory(
                candidates.stream().map(AssetEntity::getId).toList(),
                startDate
        );

        List<CandidateMetric> metrics = new ArrayList<>();
        for (AssetEntity candidate : candidates) {
            List<AssetPriceHistoryPoint> history = historyByAsset.getOrDefault(candidate.getId(), List.of());
            CandidateMetric metric = computeCandidateMetric(candidate, history);
            if (metric == null) {
                continue;
            }
            metrics.add(metric);
        }

        if (metrics.isEmpty()) {
            warnings.add("Insufficient price history to score recommendations.");
            return new AssetRecommendationResponse(normalizedProfile.id, 0, List.of(), warnings);
        }

        double minAnnualReturn = metrics.stream().mapToDouble(CandidateMetric::annualReturn).min().orElse(0);
        double maxAnnualReturn = metrics.stream().mapToDouble(CandidateMetric::annualReturn).max().orElse(1);
        double minVolatility = metrics.stream().mapToDouble(CandidateMetric::annualVolatility).min().orElse(0);
        double maxVolatility = metrics.stream().mapToDouble(CandidateMetric::annualVolatility).max().orElse(1);
        double minDrawdown = metrics.stream().mapToDouble(CandidateMetric::maxDrawdown).min().orElse(0);
        double maxDrawdown = metrics.stream().mapToDouble(CandidateMetric::maxDrawdown).max().orElse(1);
        double minLiquidity = metrics.stream().mapToDouble(CandidateMetric::liquidityScore).min().orElse(0);
        double maxLiquidity = metrics.stream().mapToDouble(CandidateMetric::liquidityScore).max().orElse(1);
        double minMomentum = metrics.stream().mapToDouble(CandidateMetric::momentum).min().orElse(0);
        double maxMomentum = metrics.stream().mapToDouble(CandidateMetric::momentum).max().orElse(1);

        List<CandidateMetric> scored = new ArrayList<>();
        for (CandidateMetric metric : metrics) {
            double returnScore = normalize(metric.annualReturn(), minAnnualReturn, maxAnnualReturn);
            double stabilityScore = 1 - normalize(metric.annualVolatility(), minVolatility, maxVolatility);
            double drawdownScore = 1 - normalize(metric.maxDrawdown(), minDrawdown, maxDrawdown);
            double liquidityScore = normalize(metric.liquidityScore(), minLiquidity, maxLiquidity);
            double momentumScore = normalize(metric.momentum(), minMomentum, maxMomentum);

            double score = normalizedProfile.returnWeight * returnScore
                    + normalizedProfile.stabilityWeight * stabilityScore
                    + normalizedProfile.drawdownWeight * drawdownScore
                    + normalizedProfile.liquidityWeight * liquidityScore
                    + normalizedProfile.momentumWeight * momentumScore;

            if (metric.benchmark()) {
                score += normalizedProfile.benchmarkBonus;
            }
            if (metric.assetType() == AssetType.INDEX) {
                score += normalizedProfile.indexBias;
            }
            if (metric.annualVolatility() > normalizedProfile.maxVolatility) {
                score -= Math.min(0.25, (metric.annualVolatility() - normalizedProfile.maxVolatility) * 0.5);
            }

            scored.add(metric.withScore(score));
        }

        scored.sort(Comparator
                .comparingDouble(CandidateMetric::score)
                .reversed()
                .thenComparing(CandidateMetric::symbol));
        List<CandidateMetric> selected = scored.stream().limit(normalizedLimit).toList();
        List<Double> weights = allocateTargetWeights(selected, normalizedProfile.minWeight, normalizedProfile.maxWeight);

        double medianVol = percentile(metrics.stream().map(CandidateMetric::annualVolatility).toList(), 0.5);
        double medianReturn = percentile(metrics.stream().map(CandidateMetric::annualReturn).toList(), 0.5);
        double medianDrawdown = percentile(metrics.stream().map(CandidateMetric::maxDrawdown).toList(), 0.5);
        double medianLiquidity = percentile(metrics.stream().map(CandidateMetric::liquidityScore).toList(), 0.5);

        List<AssetRecommendationItem> items = new ArrayList<>();
        for (int i = 0; i < selected.size(); i += 1) {
            CandidateMetric metric = selected.get(i);
            items.add(new AssetRecommendationItem(
                    metric.assetId(),
                    metric.symbol(),
                    metric.name(),
                    metric.assetType().name(),
                    metric.exchange(),
                    metric.region(),
                    round(metric.score()),
                    round(weights.get(i)),
                    buildReasons(metric, medianVol, medianReturn, medianDrawdown, medianLiquidity)
            ));
        }

        return new AssetRecommendationResponse(normalizedProfile.id, items.size(), items, warnings);
    }

    @Transactional
    public AssetPriceHistoryResponse priceHistory(String query, Integer days) {
        String normalizedQuery = normalizeQuery(query);
        String normalizedLookupQuery = normalizeHistoryLookupQuery(normalizedQuery);
        int historyDays = normalizeHistoryDays(days);
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(historyDays - 1L);

        List<String> warnings = new ArrayList<>();
        if (!normalizedLookupQuery.equalsIgnoreCase(normalizedQuery)) {
            warnings.add("Symbol " + normalizedQuery.toUpperCase(Locale.ROOT)
                    + " is mapped to " + normalizedLookupQuery.toUpperCase(Locale.ROOT) + ".");
        }

        AssetEntity localAsset = resolveLocalAsset(normalizedLookupQuery);
        List<AssetPriceHistoryItem> localItems = List.of();
        if (localAsset != null) {
            localItems = assetPriceDailyRepository.findPriceHistory(
                            localAsset.getId(),
                            startDate,
                            endDate
                    ).stream()
                    .map(point -> new AssetPriceHistoryItem(point.tradeDate(), point.close()))
                    .toList();
        }

        String resolvedSymbol = localAsset != null && StringUtils.hasText(localAsset.getSymbol())
                ? localAsset.getSymbol().toUpperCase(Locale.ROOT)
                : normalizedLookupQuery.toUpperCase(Locale.ROOT);

        boolean needsRefresh = localAsset != null && historyNeedsRefresh(localItems, endDate);
        if (needsRefresh) {
            RemoteHistory remote = fetchRemoteHistory(resolvedSymbol, startDate, endDate, warnings);
            cacheRemoteHistory(localAsset, remote.items(), startDate, endDate);
            markAssetRefreshTime(localAsset, remote.items());
            localItems = assetPriceDailyRepository.findPriceHistory(
                            localAsset.getId(),
                            startDate,
                            endDate
                    ).stream()
                    .map(point -> new AssetPriceHistoryItem(point.tradeDate(), point.close()))
                    .toList();
        }

        if (localAsset != null && !localItems.isEmpty()) {
                return new AssetPriceHistoryResponse(
                        normalizedQuery,
                        localAsset.getSymbol(),
                        "DATABASE",
                        localItems.size(),
                        localItems,
                        warnings
            );
        }

        if (localAsset != null && localItems.isEmpty()) {
            warnings.add("No local price history found for symbol " + localAsset.getSymbol() + ".");
        }

        RemoteHistory remote = fetchRemoteHistory(resolvedSymbol, startDate, endDate, warnings);
        AssetEntity cacheAsset = resolveOrCreateCacheAsset(localAsset, resolvedSymbol, remote.items());
        cacheRemoteHistory(cacheAsset, remote.items(), startDate, endDate);
        markAssetRefreshTime(cacheAsset, remote.items());

        if (cacheAsset != null && !remote.items().isEmpty()) {
            List<AssetPriceHistoryItem> cachedItems = assetPriceDailyRepository.findPriceHistory(
                            cacheAsset.getId(),
                            startDate,
                            endDate
                    ).stream()
                    .map(point -> new AssetPriceHistoryItem(point.tradeDate(), point.close()))
                    .toList();
            if (!cachedItems.isEmpty()) {
                return new AssetPriceHistoryResponse(
                        normalizedQuery,
                        cacheAsset.getSymbol(),
                        "DATABASE",
                        cachedItems.size(),
                        cachedItems,
                        warnings
                );
            }
        }

        return new AssetPriceHistoryResponse(
                normalizedQuery,
                resolvedSymbol,
                remote.source(),
                remote.items().size(),
                remote.items(),
                warnings
        );
    }

    @Transactional
    public AssetCandleHistoryResponse candleHistory(String query, Integer days, String interval) {
        String normalizedQuery = normalizeQuery(query);
        String normalizedLookupQuery = normalizeHistoryLookupQuery(normalizedQuery);
        int historyDays = normalizeCandleHistoryDays(days);
        String normalizedInterval = normalizeCandleInterval(interval);
        boolean intradayInterval = isIntradayCandleInterval(normalizedInterval);
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(historyDays - 1L);

        List<String> warnings = new ArrayList<>();
        if (!normalizedLookupQuery.equalsIgnoreCase(normalizedQuery)) {
            warnings.add("Symbol " + normalizedQuery.toUpperCase(Locale.ROOT)
                    + " is mapped to " + normalizedLookupQuery.toUpperCase(Locale.ROOT) + ".");
        }

        AssetEntity localAsset = resolveLocalAsset(normalizedLookupQuery);
        String resolvedSymbol = localAsset != null && StringUtils.hasText(localAsset.getSymbol())
                ? localAsset.getSymbol().toUpperCase(Locale.ROOT)
                : normalizedLookupQuery.toUpperCase(Locale.ROOT);

        List<AssetCandleHistoryItem> cachedItems = intradayInterval
                ? List.of()
                : loadCachedCandles(
                        resolvedSymbol,
                        normalizedInterval,
                        startDate,
                        endDate
                );
        if (!cachedItems.isEmpty() && !candleCacheNeedsRefresh(cachedItems, endDate, normalizedInterval)) {
            return new AssetCandleHistoryResponse(
                    normalizedQuery,
                    resolvedSymbol,
                    "DATABASE_CANDLE_CACHE",
                    cachedItems.size(),
                    cachedItems,
                    warnings
            );
        }

        List<AssetCandleHistoryItem> twelveDataItems = List.of();
        try {
            twelveDataItems = twelveDataClient.fetchDailyCandles(
                    resolvedSymbol,
                    normalizedInterval,
                    startDate,
                    endDate
            );
        } catch (TwelveDataClient.TwelveDataLookupException ex) {
            warnings.add("Twelve Data candle lookup failed: " + sanitizeWarningMessage(ex.getMessage()) + ".");
        }
        if (!twelveDataItems.isEmpty()) {
            if (!intradayInterval) {
                cacheCandleItems(resolvedSymbol, normalizedInterval, twelveDataItems, "TWELVE_DATA");
            }
            return new AssetCandleHistoryResponse(
                    normalizedQuery,
                    resolvedSymbol,
                    "TWELVE_DATA",
                    twelveDataItems.size(),
                    twelveDataItems,
                    warnings
            );
        }

        warnings.add("No candle data returned from Twelve Data for symbol " + resolvedSymbol + ".");
        if (!cachedItems.isEmpty()) {
            warnings.add("Using stale candle cache from database.");
            return new AssetCandleHistoryResponse(
                    normalizedQuery,
                    resolvedSymbol,
                    "DATABASE_CANDLE_CACHE",
                    cachedItems.size(),
                    cachedItems,
                    warnings
            );
        }
        if (localAsset == null) {
            return new AssetCandleHistoryResponse(
                    normalizedQuery,
                    resolvedSymbol,
                    "TWELVE_DATA",
                    0,
                    List.of(),
                    warnings
            );
        }

        List<AssetCandleHistoryItem> localItems = assetPriceDailyRepository.findPriceHistory(
                        localAsset.getId(),
                        startDate,
                        endDate
                ).stream()
                .map(point -> new AssetCandleHistoryItem(
                        point.tradeDate(),
                        point.close(),
                        point.close(),
                        point.close(),
                        point.close()
                ))
                .toList();
        if (localItems.isEmpty()) {
            warnings.add("No local price history found for symbol " + resolvedSymbol + ".");
            return new AssetCandleHistoryResponse(
                    normalizedQuery,
                    resolvedSymbol,
                    "DATABASE_CLOSE_ONLY",
                    0,
                    List.of(),
                    warnings
            );
        }

        warnings.add("Falling back to database close-only candles.");
        return new AssetCandleHistoryResponse(
                normalizedQuery,
                resolvedSymbol,
                "DATABASE_CLOSE_ONLY",
                localItems.size(),
                localItems,
                warnings
        );
    }

    private List<AssetCandleHistoryItem> loadCachedCandles(
            String symbol,
            String interval,
            LocalDate startDate,
            LocalDate endDate
    ) {
        if (!StringUtils.hasText(symbol)) {
            return List.of();
        }
        return assetCandleCacheRepository.findBySymbolIgnoreCaseAndCandleIntervalAndTradeDateBetweenOrderByTradeDateAsc(
                        symbol.trim().toUpperCase(Locale.ROOT),
                        interval,
                        startDate,
                        endDate
                ).stream()
                .map(item -> new AssetCandleHistoryItem(
                        item.getTradeDate(),
                        item.getOpen(),
                        item.getHigh(),
                        item.getLow(),
                        item.getClose()
                ))
                .toList();
    }

    private boolean candleCacheNeedsRefresh(
            List<AssetCandleHistoryItem> cachedItems,
            LocalDate endDate,
            String interval
    ) {
        if (cachedItems == null || cachedItems.isEmpty()) {
            return true;
        }
        LocalDate latestTradeDate = cachedItems.get(cachedItems.size() - 1).tradeDate();
        if (latestTradeDate == null) {
            return true;
        }
        LocalDate staleThreshold = endDate.minusDays(candleStaleToleranceDays(interval));
        return latestTradeDate.isBefore(staleThreshold);
    }

    private int candleStaleToleranceDays(String interval) {
        return switch (interval) {
            case "1h" -> 1;
            case "1week" -> 10;
            case "1month" -> 40;
            default -> 3;
        };
    }

    private void cacheCandleItems(
            String symbol,
            String interval,
            List<AssetCandleHistoryItem> items,
            String source
    ) {
        if (!StringUtils.hasText(symbol) || !StringUtils.hasText(interval) || items == null || items.isEmpty()) {
            return;
        }
        String normalizedSymbol = symbol.trim().toUpperCase(Locale.ROOT);
        Instant now = Instant.now();
        for (AssetCandleHistoryItem item : items) {
            if (item == null
                    || item.tradeDate() == null
                    || item.open() == null
                    || item.high() == null
                    || item.low() == null
                    || item.close() == null) {
                continue;
            }

            AssetCandleCacheEntity existing = assetCandleCacheRepository
                    .findFirstBySymbolIgnoreCaseAndCandleIntervalAndTradeDateOrderByIdAsc(
                            normalizedSymbol,
                            interval,
                            item.tradeDate()
                    )
                    .orElse(null);
            if (existing != null) {
                existing.updateFrom(item.open(), item.high(), item.low(), item.close(), source, now);
                assetCandleCacheRepository.save(existing);
                continue;
            }

            assetCandleCacheRepository.save(new AssetCandleCacheEntity(
                    normalizedSymbol,
                    interval,
                    item.tradeDate(),
                    item.open(),
                    item.high(),
                    item.low(),
                    item.close(),
                    source,
                    now
            ));
        }
    }

    private DatabaseAssetDetail toDatabaseAssetDetail(AssetEntity asset, AssetLatestPriceSnapshot latestPrice) {
        AssetStockDetailEntity stockDetail = asset.getStockDetail();
        AssetEtfDetailEntity etfDetail = asset.getEtfDetail();
        AssetFundDetailEntity fundDetail = asset.getFundDetail();
        AssetFuturesDetailEntity futuresDetail = asset.getFuturesDetail();
        AssetCryptoDetailEntity cryptoDetail = asset.getCryptoDetail();
        AssetBondDetailEntity bondDetail = asset.getBondDetail();

        return new DatabaseAssetDetail(
                asset.getId(),
                asset.getSymbol(),
                asset.getName(),
                asset.getAssetType().name(),
                asset.getCurrency(),
                asset.getExchange(),
                asset.getRegion(),
                asset.isBenchmark(),
                stockDetail == null ? null : stockDetail.getSector(),
                stockDetail == null ? null : stockDetail.getIndustry(),
                stockDetail == null ? null : stockDetail.getMarketCap(),
                stockDetail == null ? null : stockDetail.getPeRatio(),
                firstNonBlank(
                        etfDetail == null ? null : etfDetail.getFundFamily(),
                        fundDetail == null ? null : fundDetail.getFundFamily()
                ),
                firstNonNull(
                        etfDetail == null ? null : etfDetail.getExpenseRatio(),
                        fundDetail == null ? null : fundDetail.getExpenseRatio()
                ),
                etfDetail == null ? null : etfDetail.getBenchmark(),
                fundDetail == null || fundDetail.getFundType() == null ? null : fundDetail.getFundType().name(),
                fundDetail == null ? null : fundDetail.getNav(),
                futuresDetail == null ? null : futuresDetail.getUnderlying(),
                futuresDetail == null ? null : futuresDetail.getExpiryDate(),
                futuresDetail == null ? null : futuresDetail.getContractSize(),
                futuresDetail == null ? null : futuresDetail.getMarginRate(),
                cryptoDetail == null ? null : cryptoDetail.getChain(),
                cryptoDetail == null ? null : cryptoDetail.getContractAddress(),
                cryptoDetail == null ? null : cryptoDetail.getCoingeckoId(),
                bondDetail == null ? null : bondDetail.getIssuer(),
                bondDetail == null || bondDetail.getBondType() == null ? null : bondDetail.getBondType().name(),
                bondDetail == null ? null : bondDetail.getFaceValue(),
                bondDetail == null ? null : bondDetail.getCouponRate(),
                bondDetail == null ? null : bondDetail.getMaturityDate(),
                latestPrice == null ? null : latestPrice.close(),
                latestPrice == null ? null : latestPrice.tradeDate()
        );
    }

    private List<DatabaseAssetDetail> buildDatabaseMatches(
            List<AssetEntity> matchedAssets,
            Map<Long, AssetLatestPriceSnapshot> latestPrices
    ) {
        List<DatabaseAssetDetail> databaseMatches = new ArrayList<>(matchedAssets.size());
        for (AssetEntity asset : matchedAssets) {
            databaseMatches.add(toDatabaseAssetDetail(asset, latestPrices.get(asset.getId())));
        }
        return databaseMatches;
    }

    private boolean shouldEnrichStockMetadata(DatabaseAssetDetail detail) {
        if (detail == null || !StringUtils.hasText(detail.symbol())) {
            return false;
        }
        if (!"STOCK".equalsIgnoreCase(detail.assetType())) {
            return false;
        }
        return !StringUtils.hasText(detail.sector()) && !StringUtils.hasText(detail.industry());
    }

    private AssetCandidate toCandidate(DatabaseAssetDetail detail) {
        return new AssetCandidate(
                detail.assetId(),
                detail.symbol(),
                detail.name(),
                detail.assetType(),
                detail.exchange(),
                normalizeRegion(detail.region(), detail.symbol())
        );
    }

    private AssetCandidate toCandidate(AssetEntity asset) {
        return new AssetCandidate(
                asset.getId(),
                asset.getSymbol(),
                asset.getName(),
                asset.getAssetType().name(),
                asset.getExchange(),
                normalizeRegion(asset.getRegion(), asset.getSymbol())
        );
    }

    private AssetCandidate toCandidate(YahooFinanceSearchResult remote) {
        return new AssetCandidate(
                null,
                remote.symbol(),
                firstNonBlank(remote.longName(), remote.shortName(), remote.symbol()),
                remote.quoteType(),
                remote.exchange(),
                normalizeRegion(remote.region(), remote.symbol())
        );
    }

    private String normalizeRegion(String rawRegion, String symbol) {
        return firstNonBlank(
                RegionCodeNormalizer.normalize(rawRegion),
                inferRegion(symbol),
                "UNKNOWN"
        );
    }

    private String normalizeQuery(String query) {
        if (!StringUtils.hasText(query)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Query must not be blank.");
        }
        return query.trim();
    }

    private int normalizeSuggestionLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_SUGGESTION_LIMIT;
        }
        if (limit < 1 || limit > MAX_SUGGESTION_LIMIT) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Limit must be between 1 and " + MAX_SUGGESTION_LIMIT + "."
            );
        }
        return limit;
    }

    private int normalizeHistoryDays(Integer days) {
        if (days == null) {
            return DEFAULT_HISTORY_DAYS;
        }
        if (days < 5 || days > MAX_HISTORY_DAYS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Days must be between 5 and " + MAX_HISTORY_DAYS + "."
            );
        }
        return days;
    }

    private int normalizeCandleHistoryDays(Integer days) {
        if (days == null) {
            return DEFAULT_HISTORY_DAYS;
        }
        if (days < 1 || days > MAX_HISTORY_DAYS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Days must be between 1 and " + MAX_HISTORY_DAYS + "."
            );
        }
        return days;
    }

    private String normalizeCandleInterval(String interval) {
        if (!StringUtils.hasText(interval)) {
            return DEFAULT_CANDLE_INTERVAL;
        }
        String normalized = interval.trim().toLowerCase(Locale.ROOT);
        if (!SUPPORTED_CANDLE_INTERVALS.contains(normalized)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Interval must be one of: 1h, 1day, 1week, 1month."
            );
        }
        return normalized;
    }

    private boolean isIntradayCandleInterval(String interval) {
        return "1h".equals(interval);
    }

    private AssetEntity resolveLocalAsset(String query) {
        List<AssetEntity> matches = assetSearchDataRepository.searchAssets(query, 5);
        if (matches.isEmpty()) {
            return null;
        }
        for (AssetEntity asset : matches) {
            if (asset.getSymbol() != null && asset.getSymbol().equalsIgnoreCase(query)) {
                return asset;
            }
        }
        // For symbol-like queries, avoid fuzzy fallback to unrelated assets.
        if (looksLikeSymbol(query)) {
            return null;
        }
        return matches.get(0);
    }

    private String normalizeHistoryLookupQuery(String query) {
        String upper = query.trim().toUpperCase(Locale.ROOT);
        if ("SSEC".equals(upper) || "000001.SS".equals(upper) || "SHCOMP".equals(upper) || "SH000001".equals(upper)) {
            return "000001.SH";
        }
        return upper;
    }

    private boolean looksLikeSymbol(String query) {
        String upper = query.trim().toUpperCase(Locale.ROOT);
        return upper.startsWith("^")
                || upper.matches("^[A-Z0-9]{1,12}(\\.[A-Z0-9]{1,6})?$");
    }

    private int normalizeRecommendationLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_RECOMMENDATION_LIMIT;
        }
        if (limit < 1 || limit > MAX_RECOMMENDATION_LIMIT) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Limit must be between 1 and " + MAX_RECOMMENDATION_LIMIT + "."
            );
        }
        return limit;
    }

    private int normalizeRecommendationLookbackDays(Integer lookbackDays) {
        if (lookbackDays == null) {
            return DEFAULT_RECOMMENDATION_LOOKBACK_DAYS;
        }
        if (lookbackDays < MIN_RECOMMENDATION_LOOKBACK_DAYS || lookbackDays > MAX_HISTORY_DAYS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Lookback days must be between " + MIN_RECOMMENDATION_LOOKBACK_DAYS + " and " + MAX_HISTORY_DAYS + "."
            );
        }
        return lookbackDays;
    }

    private CandidateMetric computeCandidateMetric(AssetEntity candidate, List<AssetPriceHistoryPoint> history) {
        if (history == null || history.size() < 3) {
            return null;
        }
        List<Double> closes = history.stream()
                .map(AssetPriceHistoryPoint::close)
                .filter(value -> value != null && value.compareTo(BigDecimal.ZERO) > 0)
                .map(BigDecimal::doubleValue)
                .toList();
        if (closes.size() < 3) {
            return null;
        }

        List<Double> returns = new ArrayList<>();
        for (int i = 1; i < closes.size(); i += 1) {
            double prev = closes.get(i - 1);
            double curr = closes.get(i);
            if (prev <= 0 || curr <= 0) {
                continue;
            }
            returns.add(curr / prev - 1);
        }
        if (returns.size() < 2) {
            return null;
        }

        double annualReturn = average(returns) * 252;
        double annualVolatility = standardDeviation(returns) * Math.sqrt(252);
        double maxDrawdown = maxDrawdown(closes);
        double momentum = closes.get(closes.size() - 1) / closes.get(0) - 1;
        double liquidityScore = 0.5;
        if (candidate.getStockDetail() != null && candidate.getStockDetail().getMarketCap() != null) {
            liquidityScore = Math.log10(Math.max(candidate.getStockDetail().getMarketCap(), 1L));
        }

        return new CandidateMetric(
                candidate.getId(),
                candidate.getSymbol(),
                candidate.getName(),
                candidate.getAssetType(),
                candidate.getExchange(),
                candidate.getRegion(),
                candidate.isBenchmark(),
                annualReturn,
                annualVolatility,
                Math.abs(maxDrawdown),
                momentum,
                liquidityScore,
                0
        );
    }

    private double average(List<Double> values) {
        if (values.isEmpty()) {
            return 0;
        }
        double sum = 0;
        for (double value : values) {
            sum += value;
        }
        return sum / values.size();
    }

    private double standardDeviation(List<Double> values) {
        if (values.size() < 2) {
            return 0;
        }
        double mean = average(values);
        double variance = 0;
        for (double value : values) {
            variance += Math.pow(value - mean, 2);
        }
        variance /= (values.size() - 1);
        return Math.sqrt(Math.max(variance, 0));
    }

    private double maxDrawdown(List<Double> closes) {
        if (closes.isEmpty()) {
            return 0;
        }
        double peak = closes.get(0);
        double maxDrawdown = 0;
        for (double close : closes) {
            if (close > peak) {
                peak = close;
            }
            if (peak <= 0) {
                continue;
            }
            double drawdown = close / peak - 1;
            if (drawdown < maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }

    private double normalize(double value, double min, double max) {
        if (!Double.isFinite(value) || !Double.isFinite(min) || !Double.isFinite(max)) {
            return 0.5;
        }
        if (Math.abs(max - min) < 1e-9) {
            return 0.5;
        }
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    private List<Double> allocateTargetWeights(List<CandidateMetric> selected, double minWeight, double maxWeight) {
        if (selected.isEmpty()) {
            return List.of();
        }

        double minScore = selected.stream().mapToDouble(CandidateMetric::score).min().orElse(0);
        List<Double> raw = new ArrayList<>(selected.size());
        for (CandidateMetric metric : selected) {
            raw.add(Math.max(0.01, metric.score() - minScore + 0.05));
        }
        double rawSum = raw.stream().mapToDouble(Double::doubleValue).sum();
        List<Double> weights = new ArrayList<>(selected.size());
        for (double value : raw) {
            weights.add(value / (rawSum <= 0 ? 1 : rawSum));
        }

        double cap = Math.max(maxWeight, 1.0 / selected.size());
        for (int i = 0; i < weights.size(); i += 1) {
            if (weights.get(i) > cap) {
                weights.set(i, cap);
            }
        }
        normalizeWeightsInPlace(weights);

        if (selected.size() * minWeight <= 1.0) {
            for (int i = 0; i < weights.size(); i += 1) {
                if (weights.get(i) < minWeight) {
                    weights.set(i, minWeight);
                }
            }
            normalizeWeightsInPlace(weights);
        }

        for (int i = 0; i < weights.size(); i += 1) {
            weights.set(i, round(weights.get(i)));
        }
        normalizeWeightsInPlace(weights);
        return weights;
    }

    private void normalizeWeightsInPlace(List<Double> weights) {
        double sum = weights.stream().mapToDouble(Double::doubleValue).sum();
        if (sum <= 0) {
            double equal = 1.0 / Math.max(weights.size(), 1);
            for (int i = 0; i < weights.size(); i += 1) {
                weights.set(i, equal);
            }
            return;
        }
        for (int i = 0; i < weights.size(); i += 1) {
            weights.set(i, weights.get(i) / sum);
        }
    }

    private List<String> buildReasons(
            CandidateMetric metric,
            double medianVol,
            double medianReturn,
            double medianDrawdown,
            double medianLiquidity
    ) {
        List<String> reasons = new ArrayList<>();
        if (metric.benchmark()) {
            reasons.add("Benchmark anchor improves baseline diversification.");
        }
        if (metric.annualVolatility() <= medianVol) {
            reasons.add("Recent realized volatility is lower than peer median.");
        }
        if (metric.annualReturn() >= medianReturn) {
            reasons.add("Recent annualized return trend is stronger than peers.");
        }
        if (metric.maxDrawdown() <= medianDrawdown) {
            reasons.add("Drawdown profile is shallower in the lookback window.");
        }
        if (metric.liquidityScore() >= medianLiquidity) {
            reasons.add("Liquidity proxy is above median (size/market depth).");
        }

        if (reasons.isEmpty()) {
            reasons.add("Risk-return balance fits the selected profile.");
        }
        return reasons.stream().limit(3).toList();
    }

    private double percentile(List<Double> values, double quantile) {
        if (values == null || values.isEmpty()) {
            return 0;
        }
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int index = (int) Math.floor(Math.max(0, Math.min(1, quantile)) * (sorted.size() - 1));
        return sorted.get(index);
    }

    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }

    private boolean historyNeedsRefresh(List<AssetPriceHistoryItem> localItems, LocalDate endDate) {
        if (localItems == null || localItems.isEmpty()) {
            return true;
        }
        LocalDate latest = localItems.get(localItems.size() - 1).tradeDate();
        return latest == null || latest.isBefore(endDate.minusDays(1));
    }

    private RemoteHistory fetchRemoteHistory(
            String symbol,
            LocalDate startDate,
            LocalDate endDate,
            List<String> warnings
    ) {
        List<RemoteHistoryProvider> providers = buildRemoteHistoryProviders(symbol, startDate, endDate);
        if (providers.isEmpty()) {
            warnings.add("No remote history providers are available.");
            return new RemoteHistory("UNAVAILABLE", List.of());
        }

        for (RemoteHistoryProvider provider : providers) {
            try {
                List<AssetPriceHistoryItem> items = provider.fetcher().get();
                if (items != null && !items.isEmpty()) {
                    return new RemoteHistory(provider.source(), items);
                }
            } catch (RuntimeException ex) {
                warnings.add("Failed to load price history from " + provider.displayName()
                        + ": " + sanitizeWarningMessage(ex.getMessage()));
            }
        }

        warnings.add("No remote price history returned for symbol " + symbol.toUpperCase(Locale.ROOT)
                + " after trying " + providers.stream().map(RemoteHistoryProvider::displayName).toList() + ".");
        return new RemoteHistory(providers.get(0).source(), List.of());
    }

    private List<RemoteHistoryProvider> buildRemoteHistoryProviders(
            String symbol,
            LocalDate startDate,
            LocalDate endDate
    ) {
        List<RemoteHistoryProvider> providers = new ArrayList<>(3);
        if (eastmoneyClient.supportsSymbol(symbol)) {
            providers.add(new RemoteHistoryProvider(
                    "EASTMONEY",
                    "Eastmoney",
                    () -> eastmoneyClient.fetchDailyHistory(symbol, startDate, endDate)
            ));
        } else {
            providers.add(new RemoteHistoryProvider(
                    "TWELVE_DATA",
                    "Twelve Data",
                    () -> twelveDataClient.fetchDailyHistory(symbol, startDate, endDate)
            ));
        }

        providers.add(new RemoteHistoryProvider(
                "YAHOO_FINANCE",
                "Yahoo Finance",
                () -> yahooFinanceClient.fetchDailyHistory(symbol, startDate, endDate)
        ));
        providers.add(new RemoteHistoryProvider(
                "FINNHUB",
                "Finnhub",
                () -> finnhubClient.fetchDailyHistory(symbol, startDate, endDate)
        ));
        return providers;
    }

    private AssetEntity resolveOrCreateCacheAsset(AssetEntity localAsset, String symbol, List<AssetPriceHistoryItem> remoteItems) {
        if (localAsset != null) {
            return localAsset;
        }
        if (remoteItems == null || remoteItems.isEmpty()) {
            return null;
        }

        String normalizedSymbol = symbol == null ? null : symbol.trim().toUpperCase(Locale.ROOT);
        if (!StringUtils.hasText(normalizedSymbol)) {
            return null;
        }

        return assetRepository.findFirstBySymbolIgnoreCaseOrderByIdAsc(normalizedSymbol)
                .orElseGet(() -> createCacheAsset(normalizedSymbol));
    }

    private AssetEntity createCacheAsset(String symbol) {
        AssetType assetType = inferAssetType(symbol);
        for (int attempt = 1; attempt <= MAX_ASSET_CREATE_RETRIES; attempt += 1) {
            long maxId = Math.max(assetRepository.findMaxId() == null ? 0L : assetRepository.findMaxId(), 0L);
            long nextId = maxId + 1L;
            AssetEntity entity = new AssetEntity(
                    nextId,
                    symbol,
                    assetType,
                    symbol,
                    inferCurrency(symbol),
                    inferExchange(symbol),
                    inferRegion(symbol),
                    assetType == AssetType.INDEX
            );
            try {
                return assetRepository.saveAndFlush(entity);
            } catch (DataIntegrityViolationException ex) {
                entityManager.clear();
                AssetEntity existing = assetRepository.findFirstBySymbolIgnoreCaseOrderByIdAsc(symbol).orElse(null);
                if (existing != null) {
                    return existing;
                }
                if (attempt == MAX_ASSET_CREATE_RETRIES) {
                    throw ex;
                }
            }
        }
        return null;
    }

    private AssetType inferAssetType(String symbol) {
        String upper = symbol.toUpperCase(Locale.ROOT);
        if (KNOWN_INDEX_SYMBOLS.contains(upper)) {
            return AssetType.INDEX;
        }
        if (upper.startsWith("^")) {
            return AssetType.INDEX;
        }
        if (upper.matches("^\\d{6}(\\.(SH|SS|SZ))?$")) {
            return AssetType.INDEX;
        }
        return AssetType.STOCK;
    }

    private String inferCurrency(String symbol) {
        String upper = symbol.toUpperCase(Locale.ROOT);
        if (upper.endsWith(".SH") || upper.endsWith(".SZ") || "SSEC".equals(upper)) {
            return "CNY";
        }
        if ("HSI".equals(upper)) {
            return "HKD";
        }
        if ("N225".equals(upper)) {
            return "JPY";
        }
        return "USD";
    }

    private String inferExchange(String symbol) {
        String upper = symbol.toUpperCase(Locale.ROOT);
        if (upper.endsWith(".SH") || "SSEC".equals(upper)) {
            return "SSE";
        }
        if (upper.endsWith(".SZ")) {
            return "SZSE";
        }
        if ("HSI".equals(upper)) {
            return "HKEX";
        }
        if ("N225".equals(upper)) {
            return "TSE";
        }
        if ("FTSE".equals(upper)) {
            return "LSE";
        }
        return "INDEX";
    }

    private String inferRegion(String symbol) {
        String upper = symbol.toUpperCase(Locale.ROOT);
        if (upper.endsWith(".SH") || upper.endsWith(".SZ") || "SSEC".equals(upper) || "000300.SH".equals(upper)) {
            return "CN";
        }
        if ("HSI".equals(upper)) {
            return "HK";
        }
        if ("N225".equals(upper)) {
            return "JP";
        }
        if ("FTSE".equals(upper)) {
            return "UK";
        }
        if ("GDAXI".equals(upper)) {
            return "DE";
        }
        if ("FCHI".equals(upper)) {
            return "FR";
        }
        if ("AXJO".equals(upper)) {
            return "AU";
        }
        if ("BSESN".equals(upper) || "NSEI".equals(upper)) {
            return "IN";
        }
        if ("KS11".equals(upper)) {
            return "KR";
        }
        if ("TSX".equals(upper)) {
            return "CA";
        }
        return "US";
    }

    private String sanitizeWarningMessage(String message) {
        if (!StringUtils.hasText(message)) {
            return "unknown error";
        }
        String trimmed = message.trim().replaceAll("\\s+", " ");
        return trimmed.length() > 220 ? trimmed.substring(0, 220) + "..." : trimmed;
    }

    private void cacheRemoteHistory(
            AssetEntity asset,
            List<AssetPriceHistoryItem> remoteItems,
            LocalDate startDate,
            LocalDate endDate
    ) {
        if (asset == null || remoteItems == null || remoteItems.isEmpty()) {
            return;
        }

        Set<LocalDate> existingDates = new HashSet<>(assetPriceDailyRepository.findTradeDates(asset.getId(), startDate, endDate));
        List<AssetPriceHistoryItem> toInsert = remoteItems.stream()
                .filter(item -> item.tradeDate() != null && item.close() != null && !existingDates.contains(item.tradeDate()))
                .toList();
        if (toInsert.isEmpty()) {
            return;
        }

        boolean hasOhlcSchema = false;
        try {
            hasOhlcSchema = assetPriceDailyRepository.countOhlcColumns() >= 3;
        } catch (RuntimeException ignored) {
            hasOhlcSchema = false;
        }

        if (hasOhlcSchema) {
            for (AssetPriceHistoryItem item : toInsert) {
                try {
                    assetPriceDailyRepository.insertPriceWithOhlc(
                            asset.getId(),
                            item.tradeDate(),
                            item.close(),
                            item.close(),
                            item.close(),
                            item.close(),
                            null
                    );
                } catch (DataIntegrityViolationException ignored) {
                    // Best-effort cache write: unique-date races should not fail the response path.
                }
            }
            return;
        }

        for (AssetPriceHistoryItem item : toInsert) {
            try {
                assetPriceDailyRepository.insertPriceCloseOnly(
                        asset.getId(),
                        item.tradeDate(),
                        item.close()
                );
            } catch (DataIntegrityViolationException ignored) {
                // Best-effort cache write: unique-date races should not fail the response path.
            }
        }
    }

    private void markAssetRefreshTime(AssetEntity asset, List<AssetPriceHistoryItem> remoteItems) {
        if (asset == null || remoteItems == null || remoteItems.isEmpty()) {
            return;
        }
        assetRepository.touchLastPriceRefreshedAt(asset.getId(), Instant.now());
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private enum RecommendationProfile {
        CONSERVATIVE("conservative", 0.15, 0.45, 0.25, 0.10, 0.05, 0.06, 0.03, 0.08, 0.45),
        BALANCED("balanced", 0.35, 0.30, 0.20, 0.10, 0.05, 0.01, 0.00, 0.10, 0.40),
        AGGRESSIVE("aggressive", 0.45, 0.15, 0.10, 0.10, 0.20, -0.04, -0.05, 0.12, 0.50);

        private final String id;
        private final double returnWeight;
        private final double stabilityWeight;
        private final double drawdownWeight;
        private final double liquidityWeight;
        private final double momentumWeight;
        private final double benchmarkBonus;
        private final double indexBias;
        private final double minWeight;
        private final double maxWeight;
        private final double maxVolatility;

        RecommendationProfile(
                String id,
                double returnWeight,
                double stabilityWeight,
                double drawdownWeight,
                double liquidityWeight,
                double momentumWeight,
                double benchmarkBonus,
                double indexBias,
                double minWeight,
                double maxWeight
        ) {
            this.id = id;
            this.returnWeight = returnWeight;
            this.stabilityWeight = stabilityWeight;
            this.drawdownWeight = drawdownWeight;
            this.liquidityWeight = liquidityWeight;
            this.momentumWeight = momentumWeight;
            this.benchmarkBonus = benchmarkBonus;
            this.indexBias = indexBias;
            this.minWeight = minWeight;
            this.maxWeight = maxWeight;
            this.maxVolatility = switch (id) {
                case "conservative" -> 0.28;
                case "balanced" -> 0.40;
                default -> 0.65;
            };
        }

        private static RecommendationProfile parse(String value) {
            if (!StringUtils.hasText(value)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile must not be blank.");
            }
            String normalized = value.trim().toLowerCase(Locale.ROOT);
            for (RecommendationProfile profile : values()) {
                if (profile.id.equals(normalized)) {
                    return profile;
                }
            }
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Profile must be one of: conservative, balanced, aggressive."
            );
        }
    }

    private record CandidateMetric(
            Long assetId,
            String symbol,
            String name,
            AssetType assetType,
            String exchange,
            String region,
            boolean benchmark,
            double annualReturn,
            double annualVolatility,
            double maxDrawdown,
            double momentum,
            double liquidityScore,
            double score
    ) {
        private CandidateMetric withScore(double value) {
            return new CandidateMetric(
                    assetId,
                    symbol,
                    name,
                    assetType,
                    exchange,
                    region,
                    benchmark,
                    annualReturn,
                    annualVolatility,
                    maxDrawdown,
                    momentum,
                    liquidityScore,
                    value
            );
        }
    }

    private record RemoteHistory(String source, List<AssetPriceHistoryItem> items) {
    }

    private record RemoteHistoryProvider(
            String source,
            String displayName,
            Supplier<List<AssetPriceHistoryItem>> fetcher
    ) {
    }
}
