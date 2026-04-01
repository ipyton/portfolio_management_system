package com.noah.portfolio.asset.service;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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

    private final AssetSearchDataRepository assetSearchDataRepository;
    private final AssetPriceDailyRepository assetPriceDailyRepository;
    private final FinnhubClient finnhubClient;
    private final TwelveDataClient twelveDataClient;
    private final EastmoneyClient eastmoneyClient;

    public AssetSearchService(
            AssetSearchDataRepository assetSearchDataRepository,
            AssetPriceDailyRepository assetPriceDailyRepository,
            FinnhubClient finnhubClient,
            TwelveDataClient twelveDataClient,
            EastmoneyClient eastmoneyClient
    ) {
        this.assetSearchDataRepository = assetSearchDataRepository;
        this.assetPriceDailyRepository = assetPriceDailyRepository;
        this.finnhubClient = finnhubClient;
        this.twelveDataClient = twelveDataClient;
        this.eastmoneyClient = eastmoneyClient;
    }

    public AssetSearchResponse search(String query) {
        String normalizedQuery = normalizeQuery(query);
        List<AssetEntity> matchedAssets = assetSearchDataRepository.searchAssets(normalizedQuery, SEARCH_LIMIT);
        Map<Long, AssetLatestPriceSnapshot> latestPrices = assetSearchDataRepository.findLatestPriceSnapshots(
                matchedAssets.stream().map(AssetEntity::getId).toList()
        );

        List<DatabaseAssetDetail> databaseMatches = matchedAssets.stream()
                .map(asset -> toDatabaseAssetDetail(asset, latestPrices.get(asset.getId())))
                .toList();
        DatabaseAssetDetail primaryDatabaseMatch = databaseMatches.isEmpty() ? null : databaseMatches.get(0);
        List<String> warnings = new ArrayList<>();

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

    @Transactional
    public AssetPriceHistoryResponse priceHistory(String query, Integer days) {
        String normalizedQuery = normalizeQuery(query);
        int historyDays = normalizeHistoryDays(days);
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(historyDays - 1L);

        List<String> warnings = new ArrayList<>();
        AssetEntity localAsset = resolveLocalAsset(normalizedQuery);
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
                : normalizedQuery.toUpperCase(Locale.ROOT);

        boolean needsRefresh = localAsset != null && historyNeedsRefresh(localItems, endDate);
        if (needsRefresh) {
            RemoteHistory remote = fetchRemoteHistory(resolvedSymbol, startDate, endDate, warnings);
            cacheRemoteHistory(localAsset, remote.items(), startDate, endDate);
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
        return new AssetPriceHistoryResponse(
                normalizedQuery,
                resolvedSymbol,
                remote.source(),
                remote.items().size(),
                remote.items(),
                warnings
        );
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

    private AssetCandidate toCandidate(DatabaseAssetDetail detail) {
        return new AssetCandidate(
                detail.assetId(),
                detail.symbol(),
                detail.name(),
                detail.assetType(),
                detail.exchange(),
                detail.region()
        );
    }

    private AssetCandidate toCandidate(AssetEntity asset) {
        return new AssetCandidate(
                asset.getId(),
                asset.getSymbol(),
                asset.getName(),
                asset.getAssetType().name(),
                asset.getExchange(),
                asset.getRegion()
        );
    }

    private AssetCandidate toCandidate(YahooFinanceSearchResult remote) {
        return new AssetCandidate(
                null,
                remote.symbol(),
                firstNonBlank(remote.longName(), remote.shortName(), remote.symbol()),
                remote.quoteType(),
                remote.exchange(),
                remote.region()
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
        return matches.get(0);
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
        if (eastmoneyClient.supportsSymbol(symbol)) {
            try {
                return new RemoteHistory("EASTMONEY", eastmoneyClient.fetchDailyHistory(symbol, startDate, endDate));
            } catch (EastmoneyClient.EastmoneyLookupException ex) {
                warnings.add("Failed to load price history from Eastmoney.");
                return new RemoteHistory("EASTMONEY", List.of());
            }
        }
        try {
            return new RemoteHistory("TWELVE_DATA", twelveDataClient.fetchDailyHistory(symbol, startDate, endDate));
        } catch (TwelveDataClient.TwelveDataLookupException ex) {
            warnings.add("Failed to load price history from Twelve Data.");
            return new RemoteHistory("TWELVE_DATA", List.of());
        }
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

        List<AssetPriceDailyEntity> entities = toInsert.stream()
                .map(item -> new AssetPriceDailyEntity(asset, item.tradeDate(), item.close()))
                .toList();
        try {
            assetPriceDailyRepository.saveAll(entities);
        } catch (DataIntegrityViolationException ignored) {
            // Best-effort cache write: unique-date races should not fail the response path.
        }
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

    private record RemoteHistory(String source, List<AssetPriceHistoryItem> items) {
    }
}
