package com.noah.portfolio.fx.service;

import com.noah.portfolio.fx.config.*;
import com.noah.portfolio.fx.controller.*;
import com.noah.portfolio.fx.entity.*;
import com.noah.portfolio.fx.repository.*;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.noah.portfolio.asset.client.YahooFinanceClient;

@Service
public class FxRateService {

    private static final Logger log = LoggerFactory.getLogger(FxRateService.class);
    private static final MathContext DIVISION_CONTEXT = new MathContext(12, RoundingMode.HALF_UP);
    private static final int SCALE = 8;
    private static final String YAHOO_FINANCE = "YAHOO_FINANCE";
    private static final String SYSTEM = "SYSTEM";

    private final FxProperties fxProperties;
    private final FxRateLatestRepository fxRateLatestRepository;
    private final FxRateHistoryRepository fxRateHistoryRepository;
    private final YahooFinanceClient yahooFinanceClient;

    public FxRateService(
            FxProperties fxProperties,
            FxRateLatestRepository fxRateLatestRepository,
            FxRateHistoryRepository fxRateHistoryRepository,
            YahooFinanceClient yahooFinanceClient
    ) {
        this.fxProperties = fxProperties;
        this.fxRateLatestRepository = fxRateLatestRepository;
        this.fxRateHistoryRepository = fxRateHistoryRepository;
        this.yahooFinanceClient = yahooFinanceClient;
    }

    @Transactional
    public int refreshLatestRates() {
        if (!fxProperties.isEnabled()) {
            log.info("FX refresh skipped because fx.enabled=false");
            return 0;
        }

        Instant syncedAt = Instant.now();
        String reportingCurrency = normalize(fxProperties.getReportingCurrency());
        upsertLatest(reportingCurrency, reportingCurrency, BigDecimal.ONE, SYSTEM, null, syncedAt, false);

        int refreshed = 0;
        for (String currency : fxProperties.getTrackedCurrencies()) {
            String baseCurrency = normalize(currency);
            if (!isTrackable(baseCurrency, reportingCurrency)) {
                continue;
            }

            String symbol = fxProperties.symbolFor(baseCurrency);
            if (symbol == null || symbol.isBlank()) {
                log.warn("Missing FX symbol mapping for currency {}", baseCurrency);
                continue;
            }

            Optional<BigDecimal> maybeRate = yahooFinanceClient.fetchRegularMarketPrice(symbol);
            if (maybeRate.isEmpty()) {
                log.warn("No FX rate returned for symbol {}", symbol);
                continue;
            }

            upsertLatest(
                    baseCurrency,
                    reportingCurrency,
                    maybeRate.get().setScale(SCALE, RoundingMode.HALF_UP),
                    YAHOO_FINANCE,
                    symbol,
                    syncedAt,
                    fxProperties.isPersistHistory()
            );
            refreshed++;
        }

        return refreshed;
    }

    @Transactional(readOnly = true)
    public Optional<BigDecimal> getConversionRate(String fromCurrency, String toCurrency) {
        String from = normalize(fromCurrency);
        String to = normalize(toCurrency);
        if (from == null || to == null) {
            return Optional.empty();
        }
        if (from.equals(to)) {
            return Optional.of(BigDecimal.ONE.setScale(SCALE, RoundingMode.HALF_UP));
        }

        BigDecimal direct = resolveStoredRate(from, to);
        if (direct != null) {
            return Optional.of(direct);
        }

        String reportingCurrency = normalize(fxProperties.getReportingCurrency());
        BigDecimal fromToReporting = resolveStoredRate(from, reportingCurrency);
        BigDecimal toToReporting = resolveStoredRate(to, reportingCurrency);
        if (fromToReporting == null || toToReporting == null || BigDecimal.ZERO.compareTo(toToReporting) == 0) {
            return Optional.empty();
        }

        return Optional.of(fromToReporting.divide(toToReporting, DIVISION_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP));
    }

    @Transactional(readOnly = true)
    public Optional<BigDecimal> convert(BigDecimal amount, String fromCurrency, String toCurrency) {
        if (amount == null) {
            return Optional.empty();
        }
        return getConversionRate(fromCurrency, toCurrency)
                .map(rate -> amount.multiply(rate).setScale(6, RoundingMode.HALF_UP));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> latestSnapshot(String targetCurrency) {
        String quoteCurrency = normalize(targetCurrency == null ? fxProperties.getReportingCurrency() : targetCurrency);
        Instant asOf = latestAsOf();
        List<Map<String, Object>> rates = fxProperties.getTrackedCurrencies().stream()
                .map(this::normalize)
                .distinct()
                .map(baseCurrency -> {
                    Optional<BigDecimal> maybeRate = getConversionRate(baseCurrency, quoteCurrency);
                    if (maybeRate.isEmpty()) {
                        return null;
                    }
                    LinkedHashMap<String, Object> item = new LinkedHashMap<>();
                    item.put("baseCurrency", baseCurrency);
                    item.put("quoteCurrency", quoteCurrency);
                    item.put("rate", maybeRate.get());
                    item.put("source", YAHOO_FINANCE);
                    item.put("symbol", baseCurrency.equals(quoteCurrency) ? null : fxProperties.symbolFor(baseCurrency));
                    item.put("asOf", asOf);
                    item.put("stale", isStale(asOf));
                    return item;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        LinkedHashMap<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("reportingCurrency", quoteCurrency);
        snapshot.put("asOf", asOf);
        snapshot.put("rates", rates);
        return snapshot;
    }

    @Transactional(readOnly = true)
    public Instant latestAsOf() {
        return fxRateLatestRepository.findMaxAsOf();
    }

    @Transactional(readOnly = true)
    public boolean isStale(Instant asOf) {
        if (asOf == null) {
            return true;
        }
        Duration staleAfter = fxProperties.getStaleAfter();
        return staleAfter != null && asOf.isBefore(Instant.now().minus(staleAfter));
    }

    @Transactional(readOnly = true)
    public String reportingCurrency() {
        return normalize(fxProperties.getReportingCurrency());
    }

    private void upsertLatest(
            String baseCurrency,
            String quoteCurrency,
            BigDecimal rate,
            String source,
            String symbol,
            Instant asOf,
            boolean persistHistory
    ) {
        FxRateLatestEntity latest = fxRateLatestRepository
                .findByBaseCurrencyAndQuoteCurrency(baseCurrency, quoteCurrency)
                .orElseGet(() -> new FxRateLatestEntity(baseCurrency, quoteCurrency, rate, source, symbol, asOf));
        if (latest.getId() == null) {
            fxRateLatestRepository.save(latest);
        } else {
            latest.update(rate, source, symbol, asOf);
            fxRateLatestRepository.save(latest);
        }

        if (persistHistory) {
            fxRateHistoryRepository.save(new FxRateHistoryEntity(baseCurrency, quoteCurrency, rate, source, symbol, asOf));
        }
    }

    private BigDecimal resolveStoredRate(String baseCurrency, String quoteCurrency) {
        Optional<FxRateLatestEntity> direct = fxRateLatestRepository.findByBaseCurrencyAndQuoteCurrency(baseCurrency, quoteCurrency);
        if (direct.isPresent()) {
            return direct.get().getRate();
        }

        Optional<FxRateLatestEntity> inverse = fxRateLatestRepository.findByBaseCurrencyAndQuoteCurrency(quoteCurrency, baseCurrency);
        if (inverse.isPresent() && inverse.get().getRate() != null && BigDecimal.ZERO.compareTo(inverse.get().getRate()) != 0) {
            return BigDecimal.ONE.divide(inverse.get().getRate(), DIVISION_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);
        }
        return null;
    }

    private boolean isTrackable(String baseCurrency, String quoteCurrency) {
        return baseCurrency != null && !baseCurrency.isBlank() && !baseCurrency.equals(quoteCurrency);
    }

    private String normalize(String currency) {
        return currency == null ? null : currency.trim().toUpperCase(Locale.ROOT);
    }
}
