package com.noah.portfolio.analytics.service;

import com.noah.portfolio.analytics.controller.*;
import com.noah.portfolio.analytics.entity.*;
import com.noah.portfolio.analytics.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.noah.portfolio.asset.client.FinnhubClient;
import com.noah.portfolio.asset.repository.AssetPriceDailyRepository;
import com.noah.portfolio.fx.service.FxRateService;
import com.noah.portfolio.scheduler.service.PortfolioNavSnapshotService;
import com.noah.portfolio.trading.entity.HoldingEntity;
import com.noah.portfolio.trading.repository.HoldingRepository;
import com.noah.portfolio.trading.repository.CashAccountRepository;
import com.noah.portfolio.trading.repository.TradeHistoryRepository;
import com.noah.portfolio.user.entity.UserEntity;
import com.noah.portfolio.user.repository.UserRepository;

@Service
@Transactional(readOnly = true)
public class PortfolioAnalyticsService {
    private static final Logger log = LoggerFactory.getLogger(PortfolioAnalyticsService.class);

    private static final double TRADING_DAYS_PER_YEAR = 252.0;
    private static final double EPSILON = 1e-9;
    private static final int SCALE = 6;
    private static final int DASHBOARD_NEWS_LIMIT = 3;
    private static final Duration NEWS_CACHE_TTL = Duration.ofMinutes(2);
    private static final Duration NAV_REBUILD_TTL = Duration.ofSeconds(30);

    private final UserRepository userRepository;
    private final PortfolioNavDailyRepository portfolioNavDailyRepository;
    private final HoldingRepository holdingRepository;
    private final CashAccountRepository cashAccountRepository;
    private final TradeHistoryRepository tradeHistoryRepository;
    private final AssetPriceDailyRepository assetPriceDailyRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final FxRateService fxRateService;
    private final FinnhubClient finnhubClient;
    private final PortfolioNavSnapshotService portfolioNavSnapshotService;
    private volatile Instant cachedNewsAt;
    private volatile List<Map<String, Object>> cachedNews = List.of();
    private final Map<Long, Instant> navRebuildAtByUser = new ConcurrentHashMap<>();

    public PortfolioAnalyticsService(
            UserRepository userRepository,
            PortfolioNavDailyRepository portfolioNavDailyRepository,
            HoldingRepository holdingRepository,
            CashAccountRepository cashAccountRepository,
            TradeHistoryRepository tradeHistoryRepository,
            AssetPriceDailyRepository assetPriceDailyRepository,
            SystemConfigRepository systemConfigRepository,
            FxRateService fxRateService,
            FinnhubClient finnhubClient,
            PortfolioNavSnapshotService portfolioNavSnapshotService
    ) {
        this.userRepository = userRepository;
        this.portfolioNavDailyRepository = portfolioNavDailyRepository;
        this.holdingRepository = holdingRepository;
        this.cashAccountRepository = cashAccountRepository;
        this.tradeHistoryRepository = tradeHistoryRepository;
        this.assetPriceDailyRepository = assetPriceDailyRepository;
        this.systemConfigRepository = systemConfigRepository;
        this.fxRateService = fxRateService;
        this.finnhubClient = finnhubClient;
        this.portfolioNavSnapshotService = portfolioNavSnapshotService;
    }

    public Map<String, Object> getDashboardSummary(Long requestedUserId, String requestedBenchmarkSymbol, String requestedBaseCurrency) {
        Long userId = resolveUserId(requestedUserId);
        if (userId == null) {
            return emptyResponse("No user data found.");
        }

        maybeAutoRebuildTodaySnapshot(userId);

        List<NavPoint> navPoints = fetchNavPoints(userId);
        List<HoldingSnapshot> holdings = fetchHoldings(userId);
        List<CashBalance> cashBalances = fetchCashBalances(userId);
        List<TradeRecord> trades = fetchTrades(userId);
        boolean hasLiveData = !holdings.isEmpty() || !cashBalances.isEmpty() || !trades.isEmpty();
        boolean hasActiveHoldings = !holdings.isEmpty();
        String reportingCurrency = resolveReportingCurrency(requestedBaseCurrency);

        LocalDate startDate = navPoints.isEmpty() ? null : navPoints.get(0).navDate();
        LocalDate endDate = navPoints.isEmpty() ? null : navPoints.get(navPoints.size() - 1).navDate();

        Map<String, List<BenchmarkPricePoint>> benchmarkSeries = startDate == null || endDate == null
                ? Collections.emptyMap()
                : fetchBenchmarkSeries(startDate, endDate);

        String dominantRegion = resolveDominantRegion(holdings, reportingCurrency);
        String primaryBenchmarkSymbol = selectPrimaryBenchmark(requestedBenchmarkSymbol, benchmarkSeries.keySet(), dominantRegion);
        double riskFreeRate = fetchRiskFreeRate(resolveRiskFreeCurrency(dominantRegion));

        List<ReturnPoint> portfolioReturns = buildPortfolioReturnSeries(navPoints);
        List<Map<String, Object>> computedBenchmarkComparisons = buildBenchmarkComparisons(
                benchmarkSeries,
                portfolioReturns,
                riskFreeRate
        );
        List<Map<String, Object>> benchmarkComparisons = hasActiveHoldings ? computedBenchmarkComparisons : List.of();
        Map<String, Object> primaryBenchmarkMetrics = hasActiveHoldings
                ? benchmarkComparisons.stream()
                        .filter(item -> Objects.equals(item.get("symbol"), primaryBenchmarkSymbol))
                        .findFirst()
                        .orElse(benchmarkComparisons.isEmpty() ? null : benchmarkComparisons.get(0))
                : null;
        Map<String, Object> benchmarkChart = hasActiveHoldings
                ? buildBenchmarkChart(navPoints, benchmarkSeries, primaryBenchmarkSymbol)
                : emptyBenchmarkChart(primaryBenchmarkSymbol, benchmarkSeries);

        double totalCash = resolveCashTotal(cashBalances, reportingCurrency);
        double totalAvailableFunds = resolveAvailableFunds(cashBalances, reportingCurrency);
        double totalHoldingMarketValue = resolveHoldingMarketValue(holdings, reportingCurrency);
        double totalPortfolioValue = totalHoldingMarketValue + totalCash;
        LocalDate asOfDate = resolveAsOfDate(navPoints, holdings);

        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("userId", userId);
        response.put("hasData", !navPoints.isEmpty() || !holdings.isEmpty() || !cashBalances.isEmpty() || !trades.isEmpty());
        response.put("asOf", asOfDate != null ? asOfDate.toString() : LocalDate.now().toString());
        response.put("performance", buildPerformanceSection(
                navPoints,
                portfolioReturns,
                benchmarkComparisons,
                benchmarkChart,
                hasLiveData
        ));
        response.put("risk", buildRiskSection(
                navPoints,
                portfolioReturns,
                primaryBenchmarkMetrics,
                riskFreeRate,
                hasActiveHoldings
        ));
        response.put("holdings", buildHoldingsSection(holdings, cashBalances, totalHoldingMarketValue, totalPortfolioValue, reportingCurrency));
        response.put("trading", buildTradingSection(trades, navPoints, totalPortfolioValue, reportingCurrency));
        response.put("news", resolveDashboardNews(primaryBenchmarkSymbol, dominantRegion));
        response.put("realtime", buildRealtimeSection(
                navPoints,
                holdings,
                cashBalances,
                totalHoldingMarketValue,
                totalCash,
                totalAvailableFunds,
                totalPortfolioValue,
                asOfDate,
                reportingCurrency,
                hasLiveData
        ));
        response.put("meta", buildMetaSection(
                navPoints,
                primaryBenchmarkMetrics,
                dominantRegion,
                benchmarkComparisons,
                trades.size(),
                holdings,
                cashBalances,
                reportingCurrency
        ));
        return response;
    }

    private void maybeAutoRebuildTodaySnapshot(Long userId) {
        Instant lastRebuildAt = navRebuildAtByUser.get(userId);
        Instant now = Instant.now();
        if (lastRebuildAt != null && Duration.between(lastRebuildAt, now).compareTo(NAV_REBUILD_TTL) < 0) {
            return;
        }
        try {
            portfolioNavSnapshotService.buildSnapshotForUser(userId);
            navRebuildAtByUser.put(userId, now);
        } catch (RuntimeException ex) {
            log.warn("Failed to auto rebuild dashboard NAV snapshot for user {}. Proceeding with existing data.", userId, ex);
        }
    }

    private List<Map<String, Object>> resolveDashboardNews(String benchmarkSymbol, String dominantRegion) {
        List<Map<String, Object>> cachedSnapshot = cachedNews;
        Instant fetchedAt = cachedNewsAt;
        Instant now = Instant.now();

        if (fetchedAt != null
                && Duration.between(fetchedAt, now).compareTo(NEWS_CACHE_TTL) < 0
                && !cachedSnapshot.isEmpty()) {
            return cachedSnapshot;
        }

        List<Map<String, Object>> freshNews = fetchDashboardNews(benchmarkSymbol, dominantRegion);
        if (!freshNews.isEmpty()) {
            cachedNews = freshNews;
            cachedNewsAt = now;
            return freshNews;
        }
        return cachedSnapshot;
    }

    private List<Map<String, Object>> fetchDashboardNews(String benchmarkSymbol, String dominantRegion) {
        String category = resolveNewsCategory(dominantRegion);
        List<FinnhubClient.NewsHeadline> newsItems;
        try {
            newsItems = finnhubClient.fetchGeneralNews(category, DASHBOARD_NEWS_LIMIT * 2);
        } catch (FinnhubClient.FinnhubLookupException ex) {
            return List.of();
        }
        if (newsItems == null || newsItems.isEmpty()) {
            return List.of();
        }

        return newsItems.stream()
                .filter(item -> StringUtils.hasText(item.headline()))
                .filter(item -> StringUtils.hasText(item.url()))
                .limit(DASHBOARD_NEWS_LIMIT)
                .map(item -> orderedMap(
                        "headline", item.headline(),
                        "source", item.source(),
                        "url", item.url(),
                        "publishedAt", item.publishedAt() == null ? null : item.publishedAt().toString(),
                        "category", category,
                        "benchmarkSymbol", benchmarkSymbol
                ))
                .toList();
    }

    private String resolveNewsCategory(String dominantRegion) {
        if ("CN".equalsIgnoreCase(dominantRegion)) {
            return "general";
        }
        return "general";
    }

    private Map<String, Object> buildPerformanceSection(
            List<NavPoint> navPoints,
            List<ReturnPoint> portfolioReturns,
            List<Map<String, Object>> benchmarkComparisons,
            Map<String, Object> benchmarkChart,
            boolean hasLiveData
    ) {
        LinkedHashMap<String, Object> performance = new LinkedHashMap<>();
        if (!hasLiveData) {
            performance.put("totalReturn", null);
            performance.put("annualizedReturn", null);
            performance.put("timeWeightedReturn", null);
            performance.put("benchmarkComparisons", List.of());
            performance.put("benchmarkChart", benchmarkChart);
            return performance;
        }
        double totalReturn = computeTotalReturn(navPoints);
        Double annualizedReturn = computeAnnualizedReturn(navPoints);
        Double timeWeightedReturn = computeTimeWeightedReturn(portfolioReturns);

        performance.put("totalReturn", roundOrNull(totalReturn, navPoints.isEmpty()));
        performance.put("annualizedReturn", annualizedReturn == null ? null : round(annualizedReturn));
        performance.put("timeWeightedReturn", timeWeightedReturn == null ? null : round(timeWeightedReturn));
        performance.put("benchmarkComparisons", benchmarkComparisons);
        performance.put("benchmarkChart", benchmarkChart);
        return performance;
    }

    private Map<String, Object> buildBenchmarkChart(
            List<NavPoint> navPoints,
            Map<String, List<BenchmarkPricePoint>> benchmarkSeries,
            String primaryBenchmarkSymbol
    ) {
        if (!StringUtils.hasText(primaryBenchmarkSymbol)) {
            return emptyBenchmarkChart(null, benchmarkSeries);
        }

        List<BenchmarkPricePoint> prices = benchmarkSeries.getOrDefault(primaryBenchmarkSymbol, List.of()).stream()
                .sorted(Comparator.comparing(BenchmarkPricePoint::tradeDate))
                .toList();
        if (prices.size() < 2 || navPoints.isEmpty()) {
            return emptyBenchmarkChart(primaryBenchmarkSymbol, benchmarkSeries);
        }

        Map<LocalDate, NavPoint> navByDate = navPoints.stream()
                .collect(Collectors.toMap(NavPoint::navDate, nav -> nav, (left, right) -> right));
        List<Map<String, Object>> points = new ArrayList<>();
        Double basePortfolio = null;
        Double baseBenchmark = null;

        for (BenchmarkPricePoint benchmarkPoint : prices) {
            NavPoint nav = navByDate.get(benchmarkPoint.tradeDate());
            if (nav == null) {
                continue;
            }
            double portfolioValue = nav.netValue() > EPSILON ? nav.netValue() : nav.totalValue();
            if (portfolioValue <= EPSILON || benchmarkPoint.closePrice() <= EPSILON) {
                continue;
            }

            if (basePortfolio == null || baseBenchmark == null) {
                basePortfolio = portfolioValue;
                baseBenchmark = benchmarkPoint.closePrice();
            }

            points.add(orderedMap(
                    "date", benchmarkPoint.tradeDate().toString(),
                    "portfolio", round((portfolioValue / basePortfolio) * 100.0),
                    "benchmark", round((benchmarkPoint.closePrice() / baseBenchmark) * 100.0)
            ));
        }

        if (points.size() < 2) {
            return emptyBenchmarkChart(primaryBenchmarkSymbol, benchmarkSeries);
        }

        BenchmarkPricePoint first = prices.get(0);
        return orderedMap(
                "symbol", first.symbol(),
                "name", first.name(),
                "region", first.region(),
                "points", points
        );
    }

    private Map<String, Object> emptyBenchmarkChart(
            String primaryBenchmarkSymbol,
            Map<String, List<BenchmarkPricePoint>> benchmarkSeries
    ) {
        BenchmarkPricePoint first = null;
        if (StringUtils.hasText(primaryBenchmarkSymbol)) {
            List<BenchmarkPricePoint> prices = benchmarkSeries.get(primaryBenchmarkSymbol);
            if (prices != null && !prices.isEmpty()) {
                first = prices.get(0);
            }
        }
        return orderedMap(
                "symbol", first == null ? primaryBenchmarkSymbol : first.symbol(),
                "name", first == null ? null : first.name(),
                "region", first == null ? null : first.region(),
                "points", List.of()
        );
    }

    private Map<String, Object> buildRiskSection(
            List<NavPoint> navPoints,
            List<ReturnPoint> portfolioReturns,
            Map<String, Object> primaryBenchmarkMetrics,
            double riskFreeRate,
            boolean hasActiveHoldings
    ) {
        LinkedHashMap<String, Object> risk = new LinkedHashMap<>();
        if (!hasActiveHoldings) {
            risk.put("annualizedVolatility", null);
            risk.put("maxDrawdown", null);
            risk.put("sharpeRatio", null);
            risk.put("riskFreeRate", null);
            risk.put("beta", null);
            risk.put("alpha", null);
            risk.put("benchmarkSymbol", null);
            risk.put("benchmarkName", null);
            return risk;
        }

        Double annualizedVolatility = computeAnnualizedVolatility(portfolioReturns);
        Double annualizedReturn = computeAnnualizedReturn(navPoints);
        Double sharpeRatio = annualizedVolatility == null || annualizedReturn == null || almostZero(annualizedVolatility)
                ? null
                : (annualizedReturn - riskFreeRate) / annualizedVolatility;

        risk.put("annualizedVolatility", annualizedVolatility == null ? null : round(annualizedVolatility));
        risk.put("maxDrawdown", navPoints.isEmpty() ? null : round(computeMaxDrawdown(navPoints)));
        risk.put("sharpeRatio", sharpeRatio == null ? null : round(sharpeRatio));
        risk.put("riskFreeRate", round(riskFreeRate));
        risk.put("beta", primaryBenchmarkMetrics == null ? null : primaryBenchmarkMetrics.get("beta"));
        risk.put("alpha", primaryBenchmarkMetrics == null ? null : primaryBenchmarkMetrics.get("alpha"));
        risk.put("benchmarkSymbol", primaryBenchmarkMetrics == null ? null : primaryBenchmarkMetrics.get("symbol"));
        risk.put("benchmarkName", primaryBenchmarkMetrics == null ? null : primaryBenchmarkMetrics.get("name"));
        return risk;
    }

    private Map<String, Object> buildHoldingsSection(
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            double totalHoldingMarketValue,
            double totalPortfolioValue,
            String reportingCurrency
    ) {
        LinkedHashMap<String, Object> holdingsSection = new LinkedHashMap<>();
        holdingsSection.put("assetClassDistribution", buildAssetClassDistribution(holdings, cashBalances, totalPortfolioValue, reportingCurrency));
        holdingsSection.put("industryDistribution", buildDistribution(
                holdings,
                HoldingSnapshot::industry,
                totalHoldingMarketValue,
                reportingCurrency
        ));
        holdingsSection.put("regionDistribution", buildDistribution(
                holdings,
                HoldingSnapshot::region,
                totalHoldingMarketValue,
                reportingCurrency
        ));
        holdingsSection.put("concentrationRisk", buildConcentrationRisk(holdings, totalHoldingMarketValue, reportingCurrency));
        return holdingsSection;
    }

    private Map<String, Object> buildTradingSection(
            List<TradeRecord> trades,
            List<NavPoint> navPoints,
            double currentPortfolioValue,
            String reportingCurrency
    ) {
        LinkedHashMap<String, Object> trading = new LinkedHashMap<>();
        double totalTradeAmount = sum(trades.stream().map(trade -> tradeAmount(trade, reportingCurrency)).toList());
        double averagePortfolioValue = navPoints.isEmpty()
                ? currentPortfolioValue
                : navPoints.stream()
                        .map(navPoint -> navTotalValue(navPoint, reportingCurrency))
                        .filter(Objects::nonNull)
                        .mapToDouble(Double::doubleValue)
                        .average()
                        .orElse(currentPortfolioValue);
        Double turnoverRate = almostZero(averagePortfolioValue) ? null : totalTradeAmount / averagePortfolioValue;

        trading.put("turnoverRate", turnoverRate == null ? null : round(turnoverRate));
        trading.put("transactionAmount", round(totalTradeAmount));
        trading.put("totalFees", round(sum(trades.stream().map(trade -> tradeFee(trade, reportingCurrency)).toList())));
        trading.put("reportingCurrency", reportingCurrency);
        trading.put("tradeCount", trades.size());
        trading.put("buySellRecords", trades.stream()
                .map(trade -> toTradeRecordMap(trade, reportingCurrency))
                .toList());
        return trading;
    }

    private Map<String, Object> buildRealtimeSection(
            List<NavPoint> navPoints,
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            double totalHoldingMarketValue,
            double totalCash,
            double totalAvailableFunds,
            double totalPortfolioValue,
            LocalDate asOfDate,
            String reportingCurrency,
            boolean hasLiveData
    ) {
        LinkedHashMap<String, Object> realtime = new LinkedHashMap<>();
        realtime.put("todayPnl", computeTodayPnl(navPoints, totalPortfolioValue, reportingCurrency, asOfDate, hasLiveData));
        realtime.put("holdingMarketValue", round(totalHoldingMarketValue));
        realtime.put("cashBalance", round(totalCash));
        realtime.put("availableFunds", round(totalAvailableFunds));
        realtime.put("reportingCurrency", reportingCurrency);
        realtime.put("cashByCurrency", cashBalances.stream()
                .map(balance -> orderedMap(
                        "currency", balance.currency(),
                        "balance", round(balance.balance()),
                        "availableBalance", round(balance.availableBalance()),
                        "frozenBalance", round(balance.frozenBalance()),
                        "reportingCurrencyBalance", roundNullable(cashBalanceValue(balance, reportingCurrency)),
                        "reportingCurrencyAvailableBalance", roundNullable(cashAvailableValue(balance, reportingCurrency))
                ))
                .toList());
        realtime.put("holdings", holdings.stream()
                .sorted(Comparator.comparing(
                        (HoldingSnapshot holding) -> nullableToZero(holdingMarketValue(holding, reportingCurrency))
                ).reversed())
                .map(holding -> toRealtimeHoldingMap(holding, totalHoldingMarketValue, reportingCurrency))
                .toList());
        return realtime;
    }

    private Map<String, Object> buildMetaSection(
            List<NavPoint> navPoints,
            Map<String, Object> primaryBenchmarkMetrics,
            String dominantRegion,
            List<Map<String, Object>> benchmarkComparisons,
            int tradeCount,
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            String reportingCurrency
    ) {
        LinkedHashMap<String, Object> meta = new LinkedHashMap<>();
        LocalDate startDate = navPoints.isEmpty() ? null : navPoints.get(0).navDate();
        LocalDate endDate = navPoints.isEmpty() ? null : navPoints.get(navPoints.size() - 1).navDate();
        Instant fxAsOf = fxRateService.latestAsOf();

        meta.put("startDate", startDate == null ? null : startDate.toString());
        meta.put("endDate", endDate == null ? null : endDate.toString());
        meta.put("navObservationCount", navPoints.size());
        meta.put("tradeRecordCount", tradeCount);
        meta.put("primaryBenchmark", primaryBenchmarkMetrics == null ? null : primaryBenchmarkMetrics.get("symbol"));
        meta.put("dominantRegion", dominantRegion);
        meta.put("benchmarkCount", benchmarkComparisons.size());
        meta.put("reportingCurrency", reportingCurrency);
        meta.put("fxAsOf", fxAsOf == null ? null : fxAsOf.toString());
        meta.put("fxStale", fxAsOf == null || fxRateService.isStale(fxAsOf));
        meta.put("generatedAt", Instant.now().toString());
        meta.put("warnings", buildWarnings(navPoints, holdings, cashBalances, reportingCurrency, fxAsOf));
        return meta;
    }

    private List<String> buildWarnings(
            List<NavPoint> navPoints,
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            String reportingCurrency,
            Instant fxAsOf
    ) {
        LinkedHashSet<String> warnings = new LinkedHashSet<>();
        if (navPoints.isEmpty()) {
            warnings.add("portfolio_nav_daily is empty. Performance and risk metrics are limited.");
        }
        if (holdings.stream().anyMatch(holding -> holding.latestPrice() == null)) {
            warnings.add("Some holdings do not have latest market prices and were excluded from market-value calculations.");
        }
        if (hasCrossCurrencyExposure(holdings, cashBalances, reportingCurrency)) {
            if (fxAsOf == null) {
                warnings.add("Cross-currency exposure detected, but no FX snapshot is available. Unconvertible values were excluded.");
            } else if (fxRateService.isStale(fxAsOf)) {
                warnings.add("FX snapshot is stale. Converted holdings and cash may lag the market.");
            }
        }
        List<String> missingCurrencies = missingFxCurrencies(holdings, cashBalances, reportingCurrency);
        if (!missingCurrencies.isEmpty()) {
            warnings.add("Missing FX rate for currencies: " + String.join(", ", missingCurrencies) + ". Unconvertible values were excluded.");
        }
        return new ArrayList<>(warnings);
    }

    private List<Map<String, Object>> buildAssetClassDistribution(
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            double totalPortfolioValue,
            String reportingCurrency
    ) {
        Map<String, Double> byClass = new LinkedHashMap<>();
        holdings.forEach(holding -> {
            Double marketValue = holdingMarketValue(holding, reportingCurrency);
            if (marketValue != null) {
                byClass.merge(holding.assetType(), marketValue, Double::sum);
            }
        });
        double cashTotal = sum(cashBalances.stream().map(balance -> cashBalanceValue(balance, reportingCurrency)).toList());
        if (!almostZero(cashTotal)) {
            byClass.merge("CASH", cashTotal, Double::sum);
        }

        return byClass.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(entry -> orderedMap(
                        "name", entry.getKey(),
                        "marketValue", round(entry.getValue()),
                        "weight", weight(entry.getValue(), totalPortfolioValue)
                ))
                .toList();
    }

    private List<Map<String, Object>> buildDistribution(
            List<HoldingSnapshot> holdings,
            ValueExtractor extractor,
            double totalHoldingMarketValue,
            String reportingCurrency
    ) {
        Map<String, Double> distribution = new LinkedHashMap<>();
        holdings.forEach(holding -> {
            String key = extractor.extract(holding);
            if (!StringUtils.hasText(key)) {
                key = "UNKNOWN";
            }
            Double marketValue = holdingMarketValue(holding, reportingCurrency);
            if (marketValue != null) {
                distribution.merge(key, marketValue, Double::sum);
            }
        });

        return distribution.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(entry -> orderedMap(
                        "name", entry.getKey(),
                        "marketValue", round(entry.getValue()),
                        "weight", weight(entry.getValue(), totalHoldingMarketValue)
                ))
                .toList();
    }

    private Map<String, Object> buildConcentrationRisk(
            List<HoldingSnapshot> holdings,
            double totalHoldingMarketValue,
            String reportingCurrency
    ) {
        LinkedHashMap<String, Object> concentration = new LinkedHashMap<>();
        List<HoldingSnapshot> sorted = holdings.stream()
                .sorted(Comparator.comparing(
                        (HoldingSnapshot holding) -> nullableToZero(holdingMarketValue(holding, reportingCurrency))
                ).reversed())
                .toList();

        double herfindahlIndex = sorted.stream()
                .mapToDouble(holding -> {
                    Double marketValue = holdingMarketValue(holding, reportingCurrency);
                    double w = totalHoldingMarketValue <= EPSILON || marketValue == null
                            ? 0
                            : marketValue / totalHoldingMarketValue;
                    return w * w;
                })
                .sum();

        concentration.put("largestHoldingWeight", sorted.isEmpty() ? null : weight(holdingMarketValue(sorted.get(0), reportingCurrency), totalHoldingMarketValue));
        concentration.put("top3Weight", round(sorted.stream()
                .limit(3)
                .map(holding -> holdingMarketValue(holding, reportingCurrency))
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum() / (totalHoldingMarketValue <= EPSILON ? 1 : totalHoldingMarketValue)));
        concentration.put("herfindahlIndex", sorted.isEmpty() ? null : round(herfindahlIndex));
        concentration.put("topHoldings", sorted.stream()
                .limit(10)
                .map(holding -> orderedMap(
                        "symbol", holding.symbol(),
                        "name", holding.name(),
                        "assetType", holding.assetType(),
                        "marketValue", roundNullable(holdingMarketValue(holding, reportingCurrency)),
                        "weight", weight(holdingMarketValue(holding, reportingCurrency), totalHoldingMarketValue)
                ))
                .toList());
        return concentration;
    }

    private List<Map<String, Object>> buildBenchmarkComparisons(
            Map<String, List<BenchmarkPricePoint>> benchmarkSeries,
            List<ReturnPoint> portfolioReturns,
            double riskFreeRate
    ) {
        List<Map<String, Object>> comparisons = new ArrayList<>();
        for (Map.Entry<String, List<BenchmarkPricePoint>> entry : benchmarkSeries.entrySet()) {
            List<BenchmarkPricePoint> prices = entry.getValue();
            if (prices.size() < 2) {
                continue;
            }

            BenchmarkPricePoint first = prices.get(0);
            BenchmarkPricePoint last = prices.get(prices.size() - 1);
            double totalReturn = growthRatio(first.closePrice(), last.closePrice()) - 1;
            Double annualizedReturn = computeAnnualizedReturn(first.tradeDate(), last.tradeDate(), first.closePrice(), last.closePrice());
            List<ReturnPoint> benchmarkReturns = buildBenchmarkReturnSeries(prices);
            AlignedReturnSeries alignedReturns = alignReturnSeries(portfolioReturns, benchmarkReturns);
            Double alignedPortfolioTwr = computeTimeWeightedReturnFromDailyReturns(alignedReturns.portfolioDailyReturns());
            Double alignedBenchmarkTwr = computeTimeWeightedReturnFromDailyReturns(alignedReturns.benchmarkDailyReturns());
            Double beta = computeBeta(alignedReturns.portfolioDailyReturns(), alignedReturns.benchmarkDailyReturns());
            Double alignedPortfolioAnnualized = computeAnnualizedReturnFromDailyReturns(alignedReturns.portfolioDailyReturns());
            Double alignedBenchmarkAnnualized = computeAnnualizedReturnFromDailyReturns(alignedReturns.benchmarkDailyReturns());
            Double alpha = alignedPortfolioAnnualized == null || alignedBenchmarkAnnualized == null || beta == null
                    ? null
                    : computeAnnualizedAlpha(
                            alignedPortfolioAnnualized,
                            alignedBenchmarkAnnualized,
                            riskFreeRate,
                            beta
                    );

            comparisons.add(orderedMap(
                    "symbol", first.symbol(),
                    "name", first.name(),
                    "region", first.region(),
                    "totalReturn", round(totalReturn),
                    "annualizedReturn", annualizedReturn == null ? null : round(annualizedReturn),
                    "excessReturn", alignedPortfolioTwr == null || alignedBenchmarkTwr == null
                            ? null
                            : round(alignedPortfolioTwr - alignedBenchmarkTwr),
                    "beta", beta == null ? null : round(beta),
                    "alpha", alpha == null ? null : round(alpha),
                    "observationCount", alignedReturns.observationCount()
            ));
        }

        return comparisons.stream()
                .sorted(Comparator.comparing(item -> Objects.equals(item.get("symbol"), "000300.SH") ? 0 : 1))
                .toList();
    }

    private Map<String, Object> toTradeRecordMap(TradeRecord trade, String reportingCurrency) {
        return orderedMap(
                "tradeId", trade.tradeId(),
                "symbol", trade.symbol(),
                "assetName", trade.assetName(),
                "currency", trade.currency(),
                "tradeType", trade.tradeType(),
                "quantity", round(trade.quantity()),
                "price", round(trade.price()),
                "amount", round(trade.amount()),
                "reportingCurrencyAmount", roundNullable(tradeAmount(trade, reportingCurrency)),
                "fee", round(trade.fee()),
                "reportingCurrencyFee", roundNullable(tradeFee(trade, reportingCurrency)),
                "tradedAt", trade.tradedAt().toString(),
                "note", trade.note()
        );
    }

    private Map<String, Object> toRealtimeHoldingMap(HoldingSnapshot holding, double totalHoldingMarketValue, String reportingCurrency) {
        Double convertedMarketValue = holdingMarketValue(holding, reportingCurrency);
        return orderedMap(
                "symbol", holding.symbol(),
                "name", holding.name(),
                "assetType", holding.assetType(),
                "currency", holding.currency(),
                "reportingCurrency", reportingCurrency,
                "region", holding.region(),
                "industry", holding.industry(),
                "quantity", round(holding.quantity()),
                "avgCost", round(holding.avgCost()),
                "latestPrice", holding.latestPrice() == null ? null : round(holding.latestPrice()),
                "latestPriceDate", holding.latestPriceDate() == null ? null : holding.latestPriceDate().toString(),
                "nativeMarketValue", roundNullable(holding.marketValue()),
                "nativeUnrealizedPnl", roundNullable(holding.unrealizedPnl()),
                "marketValue", roundNullable(convertedMarketValue),
                "unrealizedPnl", roundNullable(holdingUnrealizedPnl(holding, reportingCurrency)),
                "weight", weight(convertedMarketValue, totalHoldingMarketValue)
        );
    }

    private Long resolveUserId(Long requestedUserId) {
        if (requestedUserId != null) {
            return userRepository.existsById(requestedUserId) ? requestedUserId : null;
        }
        return userRepository.findFirstByOrderByIdAsc()
                .map(UserEntity::getId)
                .orElse(null);
    }

    private List<NavPoint> fetchNavPoints(Long userId) {
        return portfolioNavDailyRepository.findByUser_IdOrderByNavDateAsc(userId).stream()
                .map(nav -> new NavPoint(
                        nav.getNavDate(),
                        decimalToDouble(nav.getTotalValue()),
                        decimalToDouble(nav.getHoldingValue()),
                        decimalToDouble(nav.getCash()),
                        decimalToDouble(nav.getNetValue()),
                        decimalToNullableDouble(nav.getDailyReturn())
                ))
                .toList();
    }

    private List<HoldingSnapshot> fetchHoldings(Long userId) {
        List<HoldingEntity> holdings = holdingRepository.findActiveHoldingsWithAssetDetailsByUserId(userId);
        if (holdings.isEmpty()) {
            return List.of();
        }

        List<Long> assetIds = holdings.stream()
                .map(holding -> holding.getAsset().getId())
                .distinct()
                .toList();

        Map<Long, AssetPriceDailyRepository.AssetLatestPriceView> latestPricesByAssetId = assetPriceDailyRepository
                .findLatestPriceViewsByAssetIdIn(assetIds)
                .stream()
                .collect(Collectors.toMap(
                        AssetPriceDailyRepository.AssetLatestPriceView::getAssetId,
                        latestPrice -> latestPrice
                ));

        return holdings.stream()
                .map(holding -> {
                    AssetPriceDailyRepository.AssetLatestPriceView latestPrice = latestPricesByAssetId.get(holding.getAsset().getId());
                    double quantity = decimalToDouble(holding.getQuantity());
                    double avgCost = decimalToDouble(holding.getAvgCost());
                    Double latestPriceValue = latestPrice == null ? null : decimalToNullableDouble(latestPrice.getClose());
                    Double marketValue = latestPriceValue == null ? null : quantity * latestPriceValue;
                    Double unrealizedPnl = latestPriceValue == null ? null : quantity * (latestPriceValue - avgCost);

                    return new HoldingSnapshot(
                            holding.getAsset().getSymbol(),
                            holding.getAsset().getName(),
                            holding.getAsset().getAssetType().name(),
                            holding.getAsset().getCurrency(),
                            textOrDefault(holding.getAsset().getRegion(), "UNKNOWN"),
                            holding.getAsset().getStockDetail() == null ? "UNKNOWN" : textOrDefault(holding.getAsset().getStockDetail().getSector(), "UNKNOWN"),
                            holding.getAsset().getStockDetail() == null ? "UNKNOWN" : textOrDefault(holding.getAsset().getStockDetail().getIndustry(), "UNKNOWN"),
                            quantity,
                            avgCost,
                            latestPriceValue,
                            latestPrice == null ? null : latestPrice.getTradeDate(),
                            marketValue,
                            unrealizedPnl
                    );
                })
                .toList();
    }

    private List<CashBalance> fetchCashBalances(Long userId) {
        return cashAccountRepository.findByUserIdOrderByCurrencyAsc(userId).stream()
                .map(account -> new CashBalance(
                        account.getCurrency(),
                        decimalToDouble(account.getBalance()),
                        decimalToDouble(account.getAvailableBalance()),
                        decimalToDouble(account.getFrozenBalance())
                ))
                .toList();
    }

    private List<TradeRecord> fetchTrades(Long userId) {
        return tradeHistoryRepository.findDetailedTradeHistoryByUserId(userId).stream()
                .map(trade -> new TradeRecord(
                        trade.getId(),
                        trade.getHolding().getAsset().getSymbol(),
                        trade.getHolding().getAsset().getName(),
                        trade.getHolding().getAsset().getCurrency(),
                        trade.getTradeType().name(),
                        decimalToDouble(trade.getQuantity()),
                        decimalToDouble(trade.getPrice()),
                        decimalToDouble(trade.getAmount()),
                        decimalToDouble(trade.getFee()),
                        trade.getTradedAt(),
                        trade.getNote()
                ))
                .toList();
    }

    private Map<String, List<BenchmarkPricePoint>> fetchBenchmarkSeries(LocalDate startDate, LocalDate endDate) {
        List<BenchmarkPricePoint> pricePoints = assetPriceDailyRepository.findBenchmarkPriceSeries(startDate, endDate).stream()
                .map(point -> new BenchmarkPricePoint(
                        point.getSymbol(),
                        point.getName(),
                        textOrDefault(point.getRegion(), "UNKNOWN"),
                        point.getTradeDate(),
                        decimalToDouble(point.getClose())
                ))
                .toList();

        return pricePoints.stream()
                .collect(Collectors.groupingBy(
                        BenchmarkPricePoint::symbol,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    private double fetchRiskFreeRate(String currency) {
        return systemConfigRepository.findByConfigKey("risk_free_rate_" + currency)
                .map(SystemConfigEntity::getConfigVal)
                .map(Double::parseDouble)
                .orElse(0.0);
    }

    private double resolveCashTotal(List<CashBalance> cashBalances, String reportingCurrency) {
        if (cashBalances.isEmpty()) {
            return 0.0;
        }
        return sum(cashBalances.stream().map(balance -> cashBalanceValue(balance, reportingCurrency)).toList());
    }

    private double resolveAvailableFunds(List<CashBalance> cashBalances, String reportingCurrency) {
        if (cashBalances.isEmpty()) {
            return 0.0;
        }
        return sum(cashBalances.stream().map(balance -> cashAvailableValue(balance, reportingCurrency)).toList());
    }

    private double resolveHoldingMarketValue(List<HoldingSnapshot> holdings, String reportingCurrency) {
        if (holdings.isEmpty()) {
            return 0.0;
        }
        return sum(holdings.stream().map(holding -> holdingMarketValue(holding, reportingCurrency)).toList());
    }

    private String resolveReportingCurrency(String requestedBaseCurrency) {
        return StringUtils.hasText(requestedBaseCurrency)
                ? requestedBaseCurrency.trim().toUpperCase()
                : fxRateService.reportingCurrency();
    }

    private Double holdingMarketValue(HoldingSnapshot holding, String reportingCurrency) {
        return convertIfAvailable(holding.marketValue(), holding.currency(), reportingCurrency);
    }

    private Double holdingUnrealizedPnl(HoldingSnapshot holding, String reportingCurrency) {
        return convertIfAvailable(holding.unrealizedPnl(), holding.currency(), reportingCurrency);
    }

    private Double cashBalanceValue(CashBalance cashBalance, String reportingCurrency) {
        return convertIfAvailable(cashBalance.balance(), cashBalance.currency(), reportingCurrency);
    }

    private Double cashAvailableValue(CashBalance cashBalance, String reportingCurrency) {
        return convertIfAvailable(cashBalance.availableBalance(), cashBalance.currency(), reportingCurrency);
    }

    private Double tradeAmount(TradeRecord trade, String reportingCurrency) {
        return convertIfAvailable(trade.amount(), trade.currency(), reportingCurrency);
    }

    private Double tradeFee(TradeRecord trade, String reportingCurrency) {
        return convertIfAvailable(trade.fee(), trade.currency(), reportingCurrency);
    }

    private Double convertIfAvailable(Double amount, String fromCurrency, String reportingCurrency) {
        if (amount == null) {
            return null;
        }
        return fxRateService.convert(BigDecimal.valueOf(amount), fromCurrency, reportingCurrency)
                .map(BigDecimal::doubleValue)
                .orElse(null);
    }

    private Double navTotalValue(NavPoint navPoint, String reportingCurrency) {
        return convertIfAvailable(navPoint.totalValue(), fxRateService.reportingCurrency(), reportingCurrency);
    }

    private Double navHoldingValue(NavPoint navPoint, String reportingCurrency) {
        return convertIfAvailable(navPoint.holdingValue(), fxRateService.reportingCurrency(), reportingCurrency);
    }

    private Double navCashValue(NavPoint navPoint, String reportingCurrency) {
        return convertIfAvailable(navPoint.cash(), fxRateService.reportingCurrency(), reportingCurrency);
    }

    private boolean hasCrossCurrencyExposure(
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            String reportingCurrency
    ) {
        return holdings.stream().anyMatch(holding -> !reportingCurrency.equalsIgnoreCase(holding.currency()))
                || cashBalances.stream().anyMatch(balance -> !reportingCurrency.equalsIgnoreCase(balance.currency()));
    }

    private List<String> missingFxCurrencies(
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            String reportingCurrency
    ) {
        LinkedHashSet<String> currencies = new LinkedHashSet<>();
        holdings.stream()
                .map(HoldingSnapshot::currency)
                .filter(currency -> !reportingCurrency.equalsIgnoreCase(currency))
                .forEach(currencies::add);
        cashBalances.stream()
                .map(CashBalance::currency)
                .filter(currency -> !reportingCurrency.equalsIgnoreCase(currency))
                .forEach(currencies::add);

        return currencies.stream()
                .filter(currency -> fxRateService.getConversionRate(currency, reportingCurrency).isEmpty())
                .toList();
    }

    private List<ReturnPoint> buildPortfolioReturnSeries(List<NavPoint> navPoints) {
        List<ReturnPoint> returns = new ArrayList<>();
        NavPoint previous = null;
        for (NavPoint navPoint : navPoints) {
            Double dailyReturn = navPoint.dailyReturn();
            if (dailyReturn == null && previous != null && previous.netValue() > EPSILON) {
                dailyReturn = navPoint.netValue() / previous.netValue() - 1;
            }
            if (dailyReturn != null) {
                returns.add(new ReturnPoint(navPoint.navDate(), dailyReturn));
            }
            previous = navPoint;
        }
        return returns;
    }

    private List<ReturnPoint> buildBenchmarkReturnSeries(List<BenchmarkPricePoint> pricePoints) {
        List<ReturnPoint> returns = new ArrayList<>();
        BenchmarkPricePoint previous = null;
        for (BenchmarkPricePoint point : pricePoints) {
            if (previous != null && previous.closePrice() > EPSILON) {
                returns.add(new ReturnPoint(point.tradeDate(), point.closePrice() / previous.closePrice() - 1));
            }
            previous = point;
        }
        return returns;
    }

    private double computeTotalReturn(List<NavPoint> navPoints) {
        if (navPoints.size() < 2) {
            return 0.0;
        }
        NavPoint first = navPoints.get(0);
        NavPoint last = navPoints.get(navPoints.size() - 1);

        if (first.netValue() > EPSILON && last.netValue() > EPSILON) {
            return growthRatio(first.netValue(), last.netValue()) - 1;
        }
        if (first.totalValue() > EPSILON && last.totalValue() > EPSILON) {
            return growthRatio(first.totalValue(), last.totalValue()) - 1;
        }
        return 0.0;
    }

    private Double computeAnnualizedReturn(List<NavPoint> navPoints) {
        if (navPoints.size() < 2) {
            return null;
        }
        NavPoint first = navPoints.get(0);
        NavPoint last = navPoints.get(navPoints.size() - 1);
        if (first.netValue() > EPSILON && last.netValue() > EPSILON) {
            return computeAnnualizedReturn(first.navDate(), last.navDate(), first.netValue(), last.netValue());
        }
        if (first.totalValue() > EPSILON && last.totalValue() > EPSILON) {
            return computeAnnualizedReturn(first.navDate(), last.navDate(), first.totalValue(), last.totalValue());
        }
        return null;
    }

    private Double computeAnnualizedReturn(LocalDate startDate, LocalDate endDate, double startValue, double endValue) {
        long days = ChronoUnit.DAYS.between(startDate, endDate);
        if (days <= 0 || startValue <= EPSILON || endValue <= EPSILON) {
            return null;
        }
        return Math.pow(endValue / startValue, 365.0 / days) - 1;
    }

    private Double computeTimeWeightedReturn(List<ReturnPoint> returnPoints) {
        return returnPoints.isEmpty() ? null : round(computeTimeWeightedReturnValue(returnPoints));
    }

    private double computeTimeWeightedReturnValue(List<ReturnPoint> returnPoints) {
        return returnPoints.stream()
                .map(ReturnPoint::dailyReturn)
                .reduce(1.0, (acc, value) -> acc * (1 + value)) - 1;
    }

    private Double computeTimeWeightedReturnFromDailyReturns(List<Double> dailyReturns) {
        if (dailyReturns.isEmpty()) {
            return null;
        }
        return dailyReturns.stream().reduce(1.0, (acc, value) -> acc * (1 + value)) - 1;
    }

    private Double computeAnnualizedVolatility(List<ReturnPoint> returnPoints) {
        if (returnPoints.size() < 2) {
            return null;
        }
        List<Double> returns = returnPoints.stream()
                .map(ReturnPoint::dailyReturn)
                .toList();
        double stdDev = sampleStandardDeviation(returns);
        return stdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);
    }

    private double computeMaxDrawdown(List<NavPoint> navPoints) {
        double peak = Double.NEGATIVE_INFINITY;
        double maxDrawdown = 0.0;
        for (NavPoint navPoint : navPoints) {
            double currentValue = navPoint.netValue() > EPSILON ? navPoint.netValue() : navPoint.totalValue();
            peak = Math.max(peak, currentValue);
            if (peak > EPSILON) {
                double drawdown = (currentValue - peak) / peak;
                maxDrawdown = Math.min(maxDrawdown, drawdown);
            }
        }
        return maxDrawdown;
    }

    private AlignedReturnSeries alignReturnSeries(List<ReturnPoint> portfolioReturns, List<ReturnPoint> benchmarkReturns) {
        Map<LocalDate, Double> portfolioByDate = portfolioReturns.stream()
                .collect(Collectors.toMap(ReturnPoint::date, ReturnPoint::dailyReturn, (left, right) -> right));
        List<Double> alignedPortfolio = new ArrayList<>();
        List<Double> alignedBenchmark = new ArrayList<>();
        for (ReturnPoint benchmarkReturn : benchmarkReturns) {
            Double portfolioReturn = portfolioByDate.get(benchmarkReturn.date());
            if (portfolioReturn != null) {
                alignedPortfolio.add(portfolioReturn);
                alignedBenchmark.add(benchmarkReturn.dailyReturn());
            }
        }
        return new AlignedReturnSeries(alignedPortfolio, alignedBenchmark);
    }

    private Double computeBeta(List<Double> alignedPortfolio, List<Double> alignedBenchmark) {
        if (alignedPortfolio.size() < 2 || alignedPortfolio.size() != alignedBenchmark.size()) {
            return null;
        }

        double variance = sampleVariance(alignedBenchmark);
        if (almostZero(variance)) {
            return null;
        }
        return covariance(alignedPortfolio, alignedBenchmark) / variance;
    }

    private Double computeAnnualizedAlpha(
            Double portfolioAnnualizedReturn,
            Double benchmarkAnnualizedReturn,
            double riskFreeRate,
            double beta
    ) {
        if (portfolioAnnualizedReturn == null || benchmarkAnnualizedReturn == null) {
            return null;
        }
        return portfolioAnnualizedReturn - (riskFreeRate + beta * (benchmarkAnnualizedReturn - riskFreeRate));
    }

    private Double computeAnnualizedReturnFromReturns(List<ReturnPoint> returnPoints) {
        if (returnPoints.isEmpty()) {
            return null;
        }
        return computeAnnualizedReturnFromDailyReturns(returnPoints.stream().map(ReturnPoint::dailyReturn).toList());
    }

    private Double computeAnnualizedReturnFromDailyReturns(List<Double> dailyReturns) {
        if (dailyReturns.isEmpty()) {
            return null;
        }
        Double twr = computeTimeWeightedReturnFromDailyReturns(dailyReturns);
        if (twr == null || 1 + twr <= EPSILON) {
            return null;
        }
        int count = dailyReturns.size();
        return Math.pow(1 + twr, TRADING_DAYS_PER_YEAR / count) - 1;
    }

    private Double computeTodayPnl(
            List<NavPoint> navPoints,
            double currentPortfolioValue,
            String reportingCurrency,
            LocalDate asOfDate,
            boolean hasLiveData
    ) {
        if (!hasLiveData) {
            return null;
        }
        if (navPoints.isEmpty()) {
            return null;
        }

        NavPoint latest = navPoints.get(navPoints.size() - 1);
        Double latestTotalValue = navTotalValue(latest, reportingCurrency);
        if (latestTotalValue == null) {
            return null;
        }
        if (asOfDate != null && asOfDate.isAfter(latest.navDate())) {
            return round(currentPortfolioValue - latestTotalValue);
        }
        if (navPoints.size() >= 2) {
            NavPoint previous = navPoints.get(navPoints.size() - 2);
            Double previousValue = navTotalValue(previous, reportingCurrency);
            return previousValue == null ? null : round(latestTotalValue - previousValue);
        }
        if (latest.dailyReturn() != null) {
            double previousTotalValue = latestTotalValue / (1 + latest.dailyReturn());
            return round(latestTotalValue - previousTotalValue);
        }
        return null;
    }

    private String resolveDominantRegion(List<HoldingSnapshot> holdings, String reportingCurrency) {
        return holdings.stream()
                .collect(Collectors.groupingBy(
                        HoldingSnapshot::region,
                        Collectors.summingDouble(holding -> nullableToZero(holdingMarketValue(holding, reportingCurrency)))
                ))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("US");
    }

    private LocalDate resolveAsOfDate(List<NavPoint> navPoints, List<HoldingSnapshot> holdings) {
        LocalDate navAsOf = navPoints.isEmpty() ? null : navPoints.get(navPoints.size() - 1).navDate();
        LocalDate marketAsOf = holdings.stream()
                .map(HoldingSnapshot::latestPriceDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);
        if (navAsOf == null) {
            return marketAsOf;
        }
        if (marketAsOf == null) {
            return navAsOf;
        }
        return marketAsOf.isAfter(navAsOf) ? marketAsOf : navAsOf;
    }

    private String resolveRiskFreeCurrency(String dominantRegion) {
        return switch (dominantRegion) {
            case "CN" -> "CNY";
            default -> "USD";
        };
    }

    private String selectPrimaryBenchmark(String requestedBenchmarkSymbol, Collection<String> availableSymbols, String dominantRegion) {
        if (StringUtils.hasText(requestedBenchmarkSymbol) && availableSymbols.contains(requestedBenchmarkSymbol)) {
            return requestedBenchmarkSymbol;
        }

        String regionDefault = switch (dominantRegion) {
            case "CN" -> "000300.SH";
            case "HK" -> "HSI";
            default -> "SPX";
        };

        if (availableSymbols.contains(regionDefault)) {
            return regionDefault;
        }
        return availableSymbols.stream().findFirst().orElse(null);
    }

    private Map<String, Object> emptyResponse(String message) {
        String reportingCurrency = fxRateService.reportingCurrency();
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("userId", null);
        response.put("hasData", false);
        response.put("asOf", LocalDate.now().toString());
        response.put("performance", orderedMap(
                "totalReturn", null,
                "annualizedReturn", null,
                "timeWeightedReturn", null,
                "benchmarkComparisons", List.of(),
                "benchmarkChart", orderedMap(
                        "symbol", null,
                        "name", null,
                        "region", null,
                        "points", List.of()
                )
        ));
        response.put("risk", orderedMap(
                "annualizedVolatility", null,
                "maxDrawdown", null,
                "sharpeRatio", null,
                "riskFreeRate", null,
                "beta", null,
                "alpha", null,
                "benchmarkSymbol", null,
                "benchmarkName", null
        ));
        response.put("holdings", orderedMap(
                "assetClassDistribution", List.of(),
                "industryDistribution", List.of(),
                "regionDistribution", List.of(),
                "concentrationRisk", orderedMap(
                        "largestHoldingWeight", null,
                        "top3Weight", null,
                        "herfindahlIndex", null,
                        "topHoldings", List.of()
                )
        ));
        response.put("trading", orderedMap(
                "turnoverRate", null,
                "transactionAmount", 0,
                "totalFees", 0,
                "reportingCurrency", reportingCurrency,
                "tradeCount", 0,
                "buySellRecords", List.of()
        ));
        response.put("news", List.of());
        response.put("realtime", orderedMap(
                "todayPnl", null,
                "holdingMarketValue", 0,
                "cashBalance", 0,
                "availableFunds", 0,
                "reportingCurrency", reportingCurrency,
                "cashByCurrency", List.of(),
                "holdings", List.of()
        ));
        response.put("meta", orderedMap(
                "startDate", null,
                "endDate", null,
                "navObservationCount", 0,
                "tradeRecordCount", 0,
                "primaryBenchmark", null,
                "dominantRegion", null,
                "benchmarkCount", 0,
                "reportingCurrency", reportingCurrency,
                "fxAsOf", null,
                "fxStale", true,
                "generatedAt", Instant.now().toString(),
                "warnings", List.of(message)
        ));
        return response;
    }

    private Map<String, Object> orderedMap(Object... keyValues) {
        LinkedHashMap<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put((String) keyValues[i], keyValues[i + 1]);
        }
        return map;
    }

    private double growthRatio(double start, double end) {
        return start <= EPSILON ? 1.0 : end / start;
    }

    private double sampleStandardDeviation(List<Double> values) {
        return Math.sqrt(sampleVariance(values));
    }

    private double sampleVariance(List<Double> values) {
        if (values.size() < 2) {
            return 0.0;
        }
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double varianceSum = values.stream()
                .mapToDouble(value -> Math.pow(value - mean, 2))
                .sum();
        return varianceSum / (values.size() - 1);
    }

    private double covariance(List<Double> left, List<Double> right) {
        if (left.size() != right.size() || left.size() < 2) {
            return 0.0;
        }
        double leftMean = left.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double rightMean = right.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double sum = 0.0;
        for (int i = 0; i < left.size(); i++) {
            sum += (left.get(i) - leftMean) * (right.get(i) - rightMean);
        }
        return sum / (left.size() - 1);
    }

    private double sum(List<Double> values) {
        return values.stream()
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();
    }

    private Double weight(Double value, double total) {
        if (value == null) {
            return null;
        }
        return total <= EPSILON ? null : round(value / total);
    }

    private boolean almostZero(double value) {
        return Math.abs(value) <= EPSILON;
    }

    private Double roundOrNull(double value, boolean nullCondition) {
        return nullCondition ? null : round(value);
    }

    private double round(double value) {
        return BigDecimal.valueOf(value)
                .setScale(SCALE, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private Double roundNullable(Double value) {
        return value == null ? null : round(value);
    }

    private double nullableToZero(Double value) {
        return value == null ? 0.0 : value;
    }

    private double decimalToDouble(BigDecimal value) {
        return value == null ? 0.0 : value.doubleValue();
    }

    private Double decimalToNullableDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private String textOrDefault(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value : defaultValue;
    }

    @FunctionalInterface
    private interface ValueExtractor {
        String extract(HoldingSnapshot holding);
    }

    private record NavPoint(
            LocalDate navDate,
            double totalValue,
            double holdingValue,
            double cash,
            double netValue,
            Double dailyReturn
    ) {
    }

    private record HoldingSnapshot(
            String symbol,
            String name,
            String assetType,
            String currency,
            String region,
            String sector,
            String industry,
            double quantity,
            double avgCost,
            Double latestPrice,
            LocalDate latestPriceDate,
            Double marketValue,
            Double unrealizedPnl
    ) {
    }

    private record CashBalance(
            String currency,
            double balance,
            double availableBalance,
            double frozenBalance
    ) {
    }

    private record TradeRecord(
            long tradeId,
            String symbol,
            String assetName,
            String currency,
            String tradeType,
            double quantity,
            double price,
            double amount,
            double fee,
            Instant tradedAt,
            String note
    ) {
    }

    private record BenchmarkPricePoint(
            String symbol,
            String name,
            String region,
            LocalDate tradeDate,
            double closePrice
    ) {
    }

    private record ReturnPoint(LocalDate date, double dailyReturn) {
    }

    private record AlignedReturnSeries(
            List<Double> portfolioDailyReturns,
            List<Double> benchmarkDailyReturns
    ) {
        private int observationCount() {
            return Math.min(portfolioDailyReturns.size(), benchmarkDailyReturns.size());
        }
    }
}
