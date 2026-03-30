package com.noah.portfolio.analytics;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
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
import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class PortfolioAnalyticsService {

    private static final double TRADING_DAYS_PER_YEAR = 252.0;
    private static final double EPSILON = 1e-9;
    private static final int SCALE = 6;

    private final JdbcTemplate jdbcTemplate;

    public PortfolioAnalyticsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> getAnalyticsSummary(String requestedBenchmarkSymbol) {
        Long userId = resolveSingleUserId();
        if (userId == null) {
            return emptyResponse("No user data found.");
        }

        List<NavPoint> navPoints = fetchNavPoints(userId);
        List<HoldingSnapshot> holdings = fetchHoldings(userId);
        List<CashBalance> cashBalances = fetchCashBalances(userId);
        List<TradeRecord> trades = fetchTrades(userId);

        LocalDate startDate = navPoints.isEmpty() ? null : navPoints.get(0).navDate();
        LocalDate endDate = navPoints.isEmpty() ? null : navPoints.get(navPoints.size() - 1).navDate();

        Map<String, List<BenchmarkPricePoint>> benchmarkSeries = startDate == null || endDate == null
                ? Collections.emptyMap()
                : fetchBenchmarkSeries(startDate, endDate);

        String dominantRegion = resolveDominantRegion(holdings);
        String primaryBenchmarkSymbol = selectPrimaryBenchmark(requestedBenchmarkSymbol, benchmarkSeries.keySet(), dominantRegion);
        double riskFreeRate = fetchRiskFreeRate(resolveRiskFreeCurrency(dominantRegion));

        List<ReturnPoint> portfolioReturns = buildPortfolioReturnSeries(navPoints);
        List<Map<String, Object>> benchmarkComparisons = buildBenchmarkComparisons(
                benchmarkSeries,
                portfolioReturns,
                riskFreeRate
        );
        Map<String, Object> primaryBenchmarkMetrics = benchmarkComparisons.stream()
                .filter(item -> Objects.equals(item.get("symbol"), primaryBenchmarkSymbol))
                .findFirst()
                .orElse(benchmarkComparisons.isEmpty() ? null : benchmarkComparisons.get(0));

        double totalCash = resolveCashTotal(navPoints, cashBalances);
        double totalHoldingMarketValue = resolveHoldingMarketValue(navPoints, holdings);
        double totalPortfolioValue = totalHoldingMarketValue + totalCash;

        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("userId", userId);
        response.put("hasData", !navPoints.isEmpty() || !holdings.isEmpty() || !cashBalances.isEmpty() || !trades.isEmpty());
        response.put("asOf", endDate != null ? endDate.toString() : LocalDate.now().toString());
        response.put("performance", buildPerformanceSection(navPoints, portfolioReturns, benchmarkComparisons));
        response.put("risk", buildRiskSection(navPoints, portfolioReturns, primaryBenchmarkMetrics, riskFreeRate));
        response.put("holdings", buildHoldingsSection(holdings, cashBalances, totalHoldingMarketValue, totalPortfolioValue));
        response.put("trading", buildTradingSection(trades, navPoints, totalPortfolioValue));
        response.put("realtime", buildRealtimeSection(navPoints, holdings, cashBalances, totalHoldingMarketValue, totalCash));
        response.put("meta", buildMetaSection(
                navPoints,
                primaryBenchmarkMetrics,
                dominantRegion,
                benchmarkComparisons,
                trades.size(),
                holdings,
                cashBalances
        ));
        return response;
    }

    private Map<String, Object> buildPerformanceSection(
            List<NavPoint> navPoints,
            List<ReturnPoint> portfolioReturns,
            List<Map<String, Object>> benchmarkComparisons
    ) {
        LinkedHashMap<String, Object> performance = new LinkedHashMap<>();
        double totalReturn = computeTotalReturn(navPoints);
        Double annualizedReturn = computeAnnualizedReturn(navPoints);
        Double timeWeightedReturn = computeTimeWeightedReturn(portfolioReturns);

        performance.put("totalReturn", roundOrNull(totalReturn, navPoints.isEmpty()));
        performance.put("annualizedReturn", annualizedReturn == null ? null : round(annualizedReturn));
        performance.put("timeWeightedReturn", timeWeightedReturn == null ? null : round(timeWeightedReturn));
        performance.put("benchmarkComparisons", benchmarkComparisons);
        return performance;
    }

    private Map<String, Object> buildRiskSection(
            List<NavPoint> navPoints,
            List<ReturnPoint> portfolioReturns,
            Map<String, Object> primaryBenchmarkMetrics,
            double riskFreeRate
    ) {
        LinkedHashMap<String, Object> risk = new LinkedHashMap<>();
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
            double totalPortfolioValue
    ) {
        LinkedHashMap<String, Object> holdingsSection = new LinkedHashMap<>();
        holdingsSection.put("assetClassDistribution", buildAssetClassDistribution(holdings, cashBalances, totalPortfolioValue));
        holdingsSection.put("industryDistribution", buildDistribution(
                holdings,
                HoldingSnapshot::industry,
                totalHoldingMarketValue
        ));
        holdingsSection.put("regionDistribution", buildDistribution(
                holdings,
                HoldingSnapshot::region,
                totalHoldingMarketValue
        ));
        holdingsSection.put("concentrationRisk", buildConcentrationRisk(holdings, totalHoldingMarketValue));
        return holdingsSection;
    }

    private Map<String, Object> buildTradingSection(
            List<TradeRecord> trades,
            List<NavPoint> navPoints,
            double currentPortfolioValue
    ) {
        LinkedHashMap<String, Object> trading = new LinkedHashMap<>();
        double totalTradeAmount = sum(trades.stream().map(TradeRecord::amount).toList());
        double averagePortfolioValue = navPoints.isEmpty()
                ? currentPortfolioValue
                : navPoints.stream().mapToDouble(NavPoint::totalValue).average().orElse(currentPortfolioValue);
        Double turnoverRate = almostZero(averagePortfolioValue) ? null : totalTradeAmount / averagePortfolioValue;

        trading.put("turnoverRate", turnoverRate == null ? null : round(turnoverRate));
        trading.put("transactionAmount", round(totalTradeAmount));
        trading.put("totalFees", round(sum(trades.stream().map(TradeRecord::fee).toList())));
        trading.put("tradeCount", trades.size());
        trading.put("buySellRecords", trades.stream()
                .map(this::toTradeRecordMap)
                .toList());
        return trading;
    }

    private Map<String, Object> buildRealtimeSection(
            List<NavPoint> navPoints,
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            double totalHoldingMarketValue,
            double totalCash
    ) {
        LinkedHashMap<String, Object> realtime = new LinkedHashMap<>();
        realtime.put("todayPnl", computeTodayPnl(navPoints));
        realtime.put("holdingMarketValue", round(totalHoldingMarketValue));
        realtime.put("cashBalance", round(totalCash));
        realtime.put("availableFunds", round(totalCash));
        realtime.put("cashByCurrency", cashBalances.stream()
                .map(balance -> orderedMap(
                        "currency", balance.currency(),
                        "balance", round(balance.balance())
                ))
                .toList());
        realtime.put("holdings", holdings.stream()
                .sorted(Comparator.comparing(HoldingSnapshot::marketValue).reversed())
                .map(holding -> toRealtimeHoldingMap(holding, totalHoldingMarketValue))
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
            List<CashBalance> cashBalances
    ) {
        LinkedHashMap<String, Object> meta = new LinkedHashMap<>();
        LocalDate startDate = navPoints.isEmpty() ? null : navPoints.get(0).navDate();
        LocalDate endDate = navPoints.isEmpty() ? null : navPoints.get(navPoints.size() - 1).navDate();

        meta.put("startDate", startDate == null ? null : startDate.toString());
        meta.put("endDate", endDate == null ? null : endDate.toString());
        meta.put("navObservationCount", navPoints.size());
        meta.put("tradeRecordCount", tradeCount);
        meta.put("primaryBenchmark", primaryBenchmarkMetrics == null ? null : primaryBenchmarkMetrics.get("symbol"));
        meta.put("dominantRegion", dominantRegion);
        meta.put("benchmarkCount", benchmarkComparisons.size());
        meta.put("generatedAt", Instant.now().toString());
        meta.put("warnings", buildWarnings(navPoints, holdings, cashBalances));
        return meta;
    }

    private List<String> buildWarnings(
            List<NavPoint> navPoints,
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances
    ) {
        LinkedHashSet<String> warnings = new LinkedHashSet<>();
        if (navPoints.isEmpty()) {
            warnings.add("portfolio_nav_daily is empty. Performance and risk metrics are limited.");
        }
        if (holdings.stream().anyMatch(holding -> holding.latestPrice() == null)) {
            warnings.add("Some holdings do not have latest market prices. Avg cost was used as fallback price.");
        }
        if (holdings.stream().map(HoldingSnapshot::currency).distinct().count() > 1
                || cashBalances.stream().map(CashBalance::currency).distinct().count() > 1) {
            warnings.add("The schema does not include FX rates. Cross-currency totals assume values are already normalized.");
        }
        return new ArrayList<>(warnings);
    }

    private List<Map<String, Object>> buildAssetClassDistribution(
            List<HoldingSnapshot> holdings,
            List<CashBalance> cashBalances,
            double totalPortfolioValue
    ) {
        Map<String, Double> byClass = new LinkedHashMap<>();
        holdings.forEach(holding -> byClass.merge(holding.assetType(), holding.marketValue(), Double::sum));
        double cashTotal = sum(cashBalances.stream().map(CashBalance::balance).toList());
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
            double totalHoldingMarketValue
    ) {
        Map<String, Double> distribution = new LinkedHashMap<>();
        holdings.forEach(holding -> {
            String key = extractor.extract(holding);
            if (!StringUtils.hasText(key)) {
                key = "UNKNOWN";
            }
            distribution.merge(key, holding.marketValue(), Double::sum);
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

    private Map<String, Object> buildConcentrationRisk(List<HoldingSnapshot> holdings, double totalHoldingMarketValue) {
        LinkedHashMap<String, Object> concentration = new LinkedHashMap<>();
        List<HoldingSnapshot> sorted = holdings.stream()
                .sorted(Comparator.comparing(HoldingSnapshot::marketValue).reversed())
                .toList();

        double herfindahlIndex = sorted.stream()
                .mapToDouble(holding -> {
                    double w = totalHoldingMarketValue <= EPSILON ? 0 : holding.marketValue() / totalHoldingMarketValue;
                    return w * w;
                })
                .sum();

        concentration.put("largestHoldingWeight", sorted.isEmpty() ? null : weight(sorted.get(0).marketValue(), totalHoldingMarketValue));
        concentration.put("top3Weight", round(sorted.stream()
                .limit(3)
                .mapToDouble(HoldingSnapshot::marketValue)
                .sum() / (totalHoldingMarketValue <= EPSILON ? 1 : totalHoldingMarketValue)));
        concentration.put("herfindahlIndex", sorted.isEmpty() ? null : round(herfindahlIndex));
        concentration.put("topHoldings", sorted.stream()
                .limit(10)
                .map(holding -> orderedMap(
                        "symbol", holding.symbol(),
                        "name", holding.name(),
                        "assetType", holding.assetType(),
                        "marketValue", round(holding.marketValue()),
                        "weight", weight(holding.marketValue(), totalHoldingMarketValue)
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
        Double portfolioTwr = portfolioReturns.isEmpty() ? null : computeTimeWeightedReturnValue(portfolioReturns);
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
            Double beta = computeBeta(portfolioReturns, benchmarkReturns);
            Double alpha = annualizedReturn == null || beta == null
                    ? null
                    : computeAnnualizedAlpha(
                            computeAnnualizedReturnFromReturns(portfolioReturns),
                            annualizedReturn,
                            riskFreeRate,
                            beta
                    );

            comparisons.add(orderedMap(
                    "symbol", first.symbol(),
                    "name", first.name(),
                    "region", first.region(),
                    "totalReturn", round(totalReturn),
                    "annualizedReturn", annualizedReturn == null ? null : round(annualizedReturn),
                    "excessReturn", portfolioTwr == null ? null : round(portfolioTwr - totalReturn),
                    "beta", beta == null ? null : round(beta),
                    "alpha", alpha == null ? null : round(alpha),
                    "observationCount", benchmarkReturns.size()
            ));
        }

        return comparisons.stream()
                .sorted(Comparator.comparing(item -> Objects.equals(item.get("symbol"), "000300.SH") ? 0 : 1))
                .toList();
    }

    private Map<String, Object> toTradeRecordMap(TradeRecord trade) {
        return orderedMap(
                "tradeId", trade.tradeId(),
                "symbol", trade.symbol(),
                "assetName", trade.assetName(),
                "tradeType", trade.tradeType(),
                "quantity", round(trade.quantity()),
                "price", round(trade.price()),
                "amount", round(trade.amount()),
                "fee", round(trade.fee()),
                "tradedAt", trade.tradedAt().toString(),
                "note", trade.note()
        );
    }

    private Map<String, Object> toRealtimeHoldingMap(HoldingSnapshot holding, double totalHoldingMarketValue) {
        return orderedMap(
                "symbol", holding.symbol(),
                "name", holding.name(),
                "assetType", holding.assetType(),
                "currency", holding.currency(),
                "region", holding.region(),
                "industry", holding.industry(),
                "quantity", round(holding.quantity()),
                "avgCost", round(holding.avgCost()),
                "latestPrice", holding.latestPrice() == null ? null : round(holding.latestPrice()),
                "latestPriceDate", holding.latestPriceDate() == null ? null : holding.latestPriceDate().toString(),
                "marketValue", round(holding.marketValue()),
                "unrealizedPnl", round(holding.unrealizedPnl()),
                "weight", weight(holding.marketValue(), totalHoldingMarketValue)
        );
    }

    private Long resolveSingleUserId() {
        List<Long> userIds = jdbcTemplate.query(
                "SELECT id FROM users ORDER BY id LIMIT 1",
                (rs, rowNum) -> rs.getLong("id")
        );
        return userIds.isEmpty() ? null : userIds.get(0);
    }

    private List<NavPoint> fetchNavPoints(Long userId) {
        return jdbcTemplate.query("""
                        SELECT nav_date, total_value, holding_value, cash, net_value, daily_return
                        FROM portfolio_nav_daily
                        WHERE user_id = ?
                        ORDER BY nav_date
                        """,
                (rs, rowNum) -> new NavPoint(
                        rs.getDate("nav_date").toLocalDate(),
                        getDouble(rs, "total_value"),
                        getDouble(rs, "holding_value"),
                        getDouble(rs, "cash"),
                        getDouble(rs, "net_value"),
                        getNullableDouble(rs, "daily_return")
                ),
                userId
        );
    }

    private List<HoldingSnapshot> fetchHoldings(Long userId) {
        return jdbcTemplate.query("""
                        SELECT
                            a.symbol,
                            a.name,
                            a.asset_type,
                            a.currency,
                            COALESCE(a.region, 'UNKNOWN') AS region,
                            COALESCE(sd.sector, 'UNKNOWN') AS sector,
                            COALESCE(sd.industry, 'UNKNOWN') AS industry,
                            h.quantity,
                            h.avg_cost,
                            latest_price.close AS latest_price,
                            latest_price.trade_date AS latest_price_date
                        FROM holdings h
                        JOIN assets a ON a.id = h.asset_id
                        LEFT JOIN asset_stock_detail sd ON sd.asset_id = a.id
                        LEFT JOIN asset_price_daily latest_price
                          ON latest_price.asset_id = a.id
                         AND latest_price.trade_date = (
                            SELECT MAX(ap.trade_date)
                            FROM asset_price_daily ap
                            WHERE ap.asset_id = a.id
                         )
                        WHERE h.user_id = ?
                          AND h.quantity <> 0
                        ORDER BY a.symbol
                        """,
                (rs, rowNum) -> mapHolding(rs),
                userId
        );
    }

    private HoldingSnapshot mapHolding(ResultSet rs) throws SQLException {
        double quantity = getDouble(rs, "quantity");
        double avgCost = getDouble(rs, "avg_cost");
        Double latestPrice = getNullableDouble(rs, "latest_price");
        double priceForValue = latestPrice == null ? avgCost : latestPrice;
        double marketValue = quantity * priceForValue;
        double unrealizedPnl = quantity * (priceForValue - avgCost);

        return new HoldingSnapshot(
                rs.getString("symbol"),
                rs.getString("name"),
                rs.getString("asset_type"),
                rs.getString("currency"),
                rs.getString("region"),
                rs.getString("sector"),
                rs.getString("industry"),
                quantity,
                avgCost,
                latestPrice,
                rs.getDate("latest_price_date") == null ? null : rs.getDate("latest_price_date").toLocalDate(),
                marketValue,
                unrealizedPnl
        );
    }

    private List<CashBalance> fetchCashBalances(Long userId) {
        return jdbcTemplate.query("""
                        SELECT currency, balance
                        FROM cash_accounts
                        WHERE user_id = ?
                        ORDER BY currency
                        """,
                (rs, rowNum) -> new CashBalance(
                        rs.getString("currency"),
                        getDouble(rs, "balance")
                ),
                userId
        );
    }

    private List<TradeRecord> fetchTrades(Long userId) {
        return jdbcTemplate.query("""
                        SELECT
                            th.id,
                            a.symbol,
                            a.name,
                            th.trade_type,
                            th.quantity,
                            th.price,
                            th.amount,
                            th.fee,
                            th.traded_at,
                            th.note
                        FROM trade_history th
                        JOIN holdings h ON h.id = th.holding_id
                        JOIN assets a ON a.id = h.asset_id
                        WHERE h.user_id = ?
                        ORDER BY th.traded_at DESC, th.id DESC
                        """,
                (rs, rowNum) -> new TradeRecord(
                        rs.getLong("id"),
                        rs.getString("symbol"),
                        rs.getString("name"),
                        rs.getString("trade_type"),
                        getDouble(rs, "quantity"),
                        getDouble(rs, "price"),
                        getDouble(rs, "amount"),
                        getDouble(rs, "fee"),
                        rs.getTimestamp("traded_at").toInstant(),
                        rs.getString("note")
                ),
                userId
        );
    }

    private Map<String, List<BenchmarkPricePoint>> fetchBenchmarkSeries(LocalDate startDate, LocalDate endDate) {
        List<BenchmarkPricePoint> pricePoints = jdbcTemplate.query("""
                        SELECT a.symbol, a.name, COALESCE(a.region, 'UNKNOWN') AS region, p.trade_date, p.close
                        FROM assets a
                        JOIN asset_price_daily p ON p.asset_id = a.id
                        WHERE a.is_benchmark = 1
                          AND p.trade_date BETWEEN ? AND ?
                        ORDER BY a.symbol, p.trade_date
                        """,
                (rs, rowNum) -> new BenchmarkPricePoint(
                        rs.getString("symbol"),
                        rs.getString("name"),
                        rs.getString("region"),
                        rs.getDate("trade_date").toLocalDate(),
                        getDouble(rs, "close")
                ),
                startDate,
                endDate
        );

        return pricePoints.stream()
                .collect(Collectors.groupingBy(
                        BenchmarkPricePoint::symbol,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    private double fetchRiskFreeRate(String currency) {
        List<Double> values = jdbcTemplate.query("""
                        SELECT config_val
                        FROM system_config
                        WHERE config_key = ?
                        LIMIT 1
                        """,
                (rs, rowNum) -> Double.parseDouble(rs.getString("config_val")),
                "risk_free_rate_" + currency
        );
        return values.isEmpty() ? 0.0 : values.get(0);
    }

    private double resolveCashTotal(List<NavPoint> navPoints, List<CashBalance> cashBalances) {
        if (!cashBalances.isEmpty()) {
            return sum(cashBalances.stream().map(CashBalance::balance).toList());
        }
        return navPoints.isEmpty() ? 0.0 : navPoints.get(navPoints.size() - 1).cash();
    }

    private double resolveHoldingMarketValue(List<NavPoint> navPoints, List<HoldingSnapshot> holdings) {
        if (!holdings.isEmpty()) {
            return sum(holdings.stream().map(HoldingSnapshot::marketValue).toList());
        }
        return navPoints.isEmpty() ? 0.0 : navPoints.get(navPoints.size() - 1).holdingValue();
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

    private Double computeBeta(List<ReturnPoint> portfolioReturns, List<ReturnPoint> benchmarkReturns) {
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

        if (alignedPortfolio.size() < 2) {
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
        double twr = computeTimeWeightedReturnValue(returnPoints);
        int count = returnPoints.size();
        return Math.pow(1 + twr, TRADING_DAYS_PER_YEAR / count) - 1;
    }

    private Double computeTodayPnl(List<NavPoint> navPoints) {
        if (navPoints.size() >= 2) {
            NavPoint latest = navPoints.get(navPoints.size() - 1);
            NavPoint previous = navPoints.get(navPoints.size() - 2);
            return round(latest.totalValue() - previous.totalValue());
        }
        if (navPoints.size() == 1 && navPoints.get(0).dailyReturn() != null) {
            NavPoint latest = navPoints.get(0);
            double previousTotalValue = latest.totalValue() / (1 + latest.dailyReturn());
            return round(latest.totalValue() - previousTotalValue);
        }
        return null;
    }

    private String resolveDominantRegion(List<HoldingSnapshot> holdings) {
        return holdings.stream()
                .collect(Collectors.groupingBy(
                        HoldingSnapshot::region,
                        Collectors.summingDouble(HoldingSnapshot::marketValue)
                ))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("US");
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
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("userId", null);
        response.put("hasData", false);
        response.put("asOf", LocalDate.now().toString());
        response.put("performance", orderedMap(
                "totalReturn", null,
                "annualizedReturn", null,
                "timeWeightedReturn", null,
                "benchmarkComparisons", List.of()
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
                "tradeCount", 0,
                "buySellRecords", List.of()
        ));
        response.put("realtime", orderedMap(
                "todayPnl", null,
                "holdingMarketValue", 0,
                "cashBalance", 0,
                "availableFunds", 0,
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

    private Double weight(double value, double total) {
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

    private double getDouble(ResultSet rs, String column) throws SQLException {
        BigDecimal value = rs.getBigDecimal(column);
        return value == null ? 0.0 : value.doubleValue();
    }

    private Double getNullableDouble(ResultSet rs, String column) throws SQLException {
        BigDecimal value = rs.getBigDecimal(column);
        return value == null ? null : value.doubleValue();
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
            double marketValue,
            double unrealizedPnl
    ) {
    }

    private record CashBalance(String currency, double balance) {
    }

    private record TradeRecord(
            long tradeId,
            String symbol,
            String assetName,
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
}
