package com.noah.portfolio.fx;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fx")
public class FxProperties {

    private boolean enabled = true;
    private String reportingCurrency = "CNY";
    private boolean persistHistory = true;
    private Duration staleAfter = Duration.ofMinutes(30);
    private List<String> trackedCurrencies = new ArrayList<>(List.of("CNY", "USD", "HKD"));
    private Map<String, String> symbols = new LinkedHashMap<>(Map.of(
            "USD", "USDCNY=X",
            "HKD", "HKDCNY=X"
    ));

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getReportingCurrency() {
        return reportingCurrency;
    }

    public void setReportingCurrency(String reportingCurrency) {
        this.reportingCurrency = normalize(reportingCurrency);
    }

    public boolean isPersistHistory() {
        return persistHistory;
    }

    public void setPersistHistory(boolean persistHistory) {
        this.persistHistory = persistHistory;
    }

    public Duration getStaleAfter() {
        return staleAfter;
    }

    public void setStaleAfter(Duration staleAfter) {
        this.staleAfter = staleAfter;
    }

    public List<String> getTrackedCurrencies() {
        return trackedCurrencies;
    }

    public void setTrackedCurrencies(List<String> trackedCurrencies) {
        this.trackedCurrencies = trackedCurrencies == null
                ? new ArrayList<>()
                : trackedCurrencies.stream().map(this::normalize).toList();
    }

    public Map<String, String> getSymbols() {
        return symbols;
    }

    public void setSymbols(Map<String, String> symbols) {
        if (symbols == null) {
            this.symbols = new LinkedHashMap<>();
            return;
        }
        LinkedHashMap<String, String> normalized = new LinkedHashMap<>();
        symbols.forEach((currency, symbol) -> normalized.put(normalize(currency), symbol));
        this.symbols = normalized;
    }

    public String symbolFor(String baseCurrency) {
        return symbols.get(normalize(baseCurrency));
    }

    public String normalize(String currency) {
        return currency == null ? null : currency.trim().toUpperCase(Locale.ROOT);
    }
}
