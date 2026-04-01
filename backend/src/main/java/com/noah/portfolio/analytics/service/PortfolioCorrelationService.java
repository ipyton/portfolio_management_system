package com.noah.portfolio.analytics.service;

import com.noah.portfolio.analytics.dto.PortfolioCorrelationResponse;
import com.noah.portfolio.asset.dto.AssetPriceHistoryItem;
import com.noah.portfolio.asset.dto.AssetPriceHistoryResponse;
import com.noah.portfolio.asset.service.AssetSearchService;
import com.noah.portfolio.analytics.entity.PortfolioNavDailyEntity;
import com.noah.portfolio.analytics.repository.PortfolioNavDailyRepository;
import com.noah.portfolio.user.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class PortfolioCorrelationService {

    private static final int DEFAULT_DAYS = 120;
    private static final int MIN_DAYS = 30;
    private static final int MAX_DAYS = 365;
    private static final int MIN_OBSERVATIONS = 10;
    private static final double EPSILON = 1e-12;

    private final UserRepository userRepository;
    private final PortfolioNavDailyRepository portfolioNavDailyRepository;
    private final AssetSearchService assetSearchService;

    public PortfolioCorrelationService(
            UserRepository userRepository,
            PortfolioNavDailyRepository portfolioNavDailyRepository,
            AssetSearchService assetSearchService
    ) {
        this.userRepository = userRepository;
        this.portfolioNavDailyRepository = portfolioNavDailyRepository;
        this.assetSearchService = assetSearchService;
    }

    public PortfolioCorrelationResponse evaluateCorrelation(Long userId, String symbol, Integer days) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId must not be null.");
        }
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }
        if (!StringUtils.hasText(symbol)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "symbol must not be blank.");
        }

        int lookbackDays = normalizeDays(days);
        String normalizedSymbol = symbol.trim().toUpperCase(Locale.ROOT);
        List<String> warnings = new ArrayList<>();

        Map<LocalDate, Double> portfolioReturns = buildPortfolioReturnSeries(userId);
        if (portfolioReturns.isEmpty()) {
            warnings.add("Portfolio return series is empty.");
        }

        AssetPriceHistoryResponse history = assetSearchService.priceHistory(normalizedSymbol, lookbackDays + 40);
        if (history.warnings() != null && !history.warnings().isEmpty()) {
            warnings.addAll(history.warnings());
        }
        Map<LocalDate, Double> assetReturns = buildAssetReturnSeries(history.items());
        if (assetReturns.isEmpty()) {
            warnings.add("Asset return series is empty.");
        }

        Set<LocalDate> overlap = new LinkedHashSet<>(portfolioReturns.keySet());
        overlap.retainAll(assetReturns.keySet());
        List<LocalDate> dates = overlap.stream().sorted().toList();
        if (dates.size() > lookbackDays) {
            dates = dates.subList(dates.size() - lookbackDays, dates.size());
        }

        List<Double> alignedPortfolio = new ArrayList<>(dates.size());
        List<Double> alignedAsset = new ArrayList<>(dates.size());
        List<PortfolioCorrelationResponse.CorrelationPoint> points = new ArrayList<>(dates.size());
        for (LocalDate date : dates) {
            Double portfolioRet = portfolioReturns.get(date);
            Double assetRet = assetReturns.get(date);
            if (portfolioRet == null || assetRet == null) {
                continue;
            }
            alignedPortfolio.add(portfolioRet);
            alignedAsset.add(assetRet);
            points.add(new PortfolioCorrelationResponse.CorrelationPoint(
                    date.toString(),
                    round(portfolioRet),
                    round(assetRet)
            ));
        }

        Double correlation = null;
        String riskHint = "Insufficient data to evaluate correlation.";
        if (alignedPortfolio.size() >= MIN_OBSERVATIONS) {
            correlation = correlation(alignedPortfolio, alignedAsset);
            if (correlation != null) {
                riskHint = classifyCorrelation(correlation);
            } else {
                warnings.add("Return variance is near zero; correlation is undefined.");
            }
        } else {
            warnings.add("Aligned observations are fewer than " + MIN_OBSERVATIONS + ".");
        }

        return new PortfolioCorrelationResponse(
                userId,
                history.resolvedSymbol() == null ? normalizedSymbol : history.resolvedSymbol().toUpperCase(Locale.ROOT),
                lookbackDays,
                alignedPortfolio.size(),
                correlation == null ? null : round(correlation),
                riskHint,
                points,
                warnings
        );
    }

    private int normalizeDays(Integer days) {
        int resolved = days == null ? DEFAULT_DAYS : days;
        if (resolved < MIN_DAYS || resolved > MAX_DAYS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "days must be between " + MIN_DAYS + " and " + MAX_DAYS + "."
            );
        }
        return resolved;
    }

    private Map<LocalDate, Double> buildPortfolioReturnSeries(Long userId) {
        List<PortfolioNavDailyEntity> nav = portfolioNavDailyRepository.findByUser_IdOrderByNavDateAsc(userId);
        Map<LocalDate, Double> byDate = new LinkedHashMap<>();
        BigDecimal prevNet = null;
        for (PortfolioNavDailyEntity point : nav) {
            Double daily = toDouble(point.getDailyReturn());
            if (daily == null && prevNet != null && prevNet.signum() != 0 && point.getNetValue() != null) {
                daily = point.getNetValue().divide(prevNet, 12, RoundingMode.HALF_UP).doubleValue() - 1.0;
            }
            if (daily != null && point.getNavDate() != null) {
                byDate.put(point.getNavDate(), daily);
            }
            prevNet = point.getNetValue();
        }
        return byDate;
    }

    private Map<LocalDate, Double> buildAssetReturnSeries(List<AssetPriceHistoryItem> items) {
        Map<LocalDate, Double> byDate = new LinkedHashMap<>();
        if (items == null || items.size() < 2) {
            return byDate;
        }
        BigDecimal prev = null;
        for (AssetPriceHistoryItem item : items) {
            if (item == null || item.tradeDate() == null || item.close() == null || item.close().signum() <= 0) {
                continue;
            }
            if (prev != null && prev.signum() > 0) {
                double value = item.close().divide(prev, 12, RoundingMode.HALF_UP).doubleValue() - 1.0;
                byDate.put(item.tradeDate(), value);
            }
            prev = item.close();
        }
        return byDate;
    }

    private Double correlation(List<Double> left, List<Double> right) {
        if (left.size() != right.size() || left.size() < 2) {
            return null;
        }
        double meanLeft = mean(left);
        double meanRight = mean(right);
        double cov = 0.0;
        double varLeft = 0.0;
        double varRight = 0.0;
        for (int i = 0; i < left.size(); i++) {
            double dl = left.get(i) - meanLeft;
            double dr = right.get(i) - meanRight;
            cov += dl * dr;
            varLeft += dl * dl;
            varRight += dr * dr;
        }
        double denom = Math.sqrt(varLeft * varRight);
        if (denom <= EPSILON) {
            return null;
        }
        return cov / denom;
    }

    private double mean(List<Double> values) {
        if (values.isEmpty()) {
            return 0.0;
        }
        double sum = 0.0;
        for (double value : values) {
            sum += value;
        }
        return sum / values.size();
    }

    private String classifyCorrelation(double corr) {
        if (corr >= 0.7) {
            return "High positive correlation: adding this name may increase concentration risk.";
        }
        if (corr >= 0.3) {
            return "Moderate positive correlation: partial diversification benefit only.";
        }
        if (corr <= -0.3) {
            return "Negative correlation: can improve diversification and reduce portfolio swing.";
        }
        return "Low correlation: likely to provide diversification benefit.";
    }

    private Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private double round(double value) {
        return Math.round(value * 1_000_000d) / 1_000_000d;
    }
}
