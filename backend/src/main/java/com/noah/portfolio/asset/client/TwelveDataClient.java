package com.noah.portfolio.asset.client;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.noah.portfolio.asset.config.TwelveDataProperties;
import com.noah.portfolio.asset.dto.AssetCandleHistoryItem;
import com.noah.portfolio.asset.dto.AssetPriceHistoryItem;

@Component
public class TwelveDataClient {

    private static final Logger log = LoggerFactory.getLogger(TwelveDataClient.class);
    private static final String TIME_SERIES_PATH = "/time_series";
    private static final String PRICE_PATH = "/price";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final TwelveDataProperties properties;
    private final Object rateLimitLock = new Object();

    private List<String> activeApiKeys = List.of();
    private final Map<String, ApiKeyState> apiKeyStates = new LinkedHashMap<>();
    private int nextApiKeyCursor = 0;
    private Instant lastGlobalThrottleWarnAt = Instant.EPOCH;

    public TwelveDataClient(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            TwelveDataProperties properties
    ) {
        this.objectMapper = objectMapper;
        this.properties = properties;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        int timeoutMillis = Math.toIntExact(properties.getTimeout().toMillis());
        requestFactory.setConnectTimeout(timeoutMillis);
        requestFactory.setReadTimeout(timeoutMillis);

        this.restClient = restClientBuilder
                .baseUrl(properties.getBaseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.USER_AGENT, "portfolio-management-system/1.0")
                .build();
    }

    public List<AssetPriceHistoryItem> fetchDailyHistory(String symbol, LocalDate startDate, LocalDate endDate) {
        return fetchDailyCandles(symbol, "1day", startDate, endDate).stream()
                .map(item -> new AssetPriceHistoryItem(item.tradeDate(), item.close()))
                .toList();
    }

    public List<AssetCandleHistoryItem> fetchDailyCandles(String symbol, LocalDate startDate, LocalDate endDate) {
        return fetchDailyCandles(symbol, "1day", startDate, endDate);
    }

    public List<AssetCandleHistoryItem> fetchDailyCandles(
            String symbol,
            String interval,
            LocalDate startDate,
            LocalDate endDate
    ) {
        if (!properties.isEnabled() || properties.resolveApiKeys().isEmpty()) {
            return List.of();
        }
        int maxAttempts = Math.max(1, properties.resolveApiKeys().size());
        for (int attempt = 0; attempt < maxAttempts; attempt += 1) {
            Optional<String> maybeApiKey = tryAcquirePermit("history", symbol);
            if (maybeApiKey.isEmpty()) {
                return List.of();
            }
            String apiKey = maybeApiKey.get();

            try {
                String response = restClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .path(TIME_SERIES_PATH)
                                .queryParam("symbol", symbol)
                                .queryParam("interval", interval)
                                .queryParam("outputsize", resolveOutputSize(interval, startDate, endDate))
                                .queryParam("apikey", apiKey)
                                .build())
                        .retrieve()
                        .body(String.class);
                JsonNode root = objectMapper.readTree(response);

                if ("error".equalsIgnoreCase(text(root, "status"))) {
                    String message = text(root, "message");
                    if (isRateLimitMessage(message)) {
                        activateCooldown("history", symbol, apiKey, message);
                        continue;
                    }
                    throw new TwelveDataLookupException("Twelve Data error: " + message, null);
                }

                JsonNode values = root.path("values");
                if (!values.isArray()) {
                    return List.of();
                }

                List<AssetCandleHistoryItem> items = new ArrayList<>();
                for (JsonNode value : values) {
                    String rawDateTime = text(value, "datetime");
                    LocalDate tradeDate = parseDate(rawDateTime);
                    BigDecimal open = decimal(text(value, "open"));
                    BigDecimal high = decimal(text(value, "high"));
                    BigDecimal low = decimal(text(value, "low"));
                    BigDecimal close = decimal(text(value, "close"));
                    if (tradeDate == null || open == null || high == null || low == null || close == null) {
                        continue;
                    }
                    if (tradeDate.isBefore(startDate) || tradeDate.isAfter(endDate)) {
                        continue;
                    }
                    items.add(new AssetCandleHistoryItem(
                            tradeDate,
                            normalizeDateTime(rawDateTime),
                            open,
                            high,
                            low,
                            close
                    ));
                }

                items.sort(Comparator.comparing(AssetCandleHistoryItem::tradeDate));
                return items;
            } catch (IOException | RestClientException ex) {
                throw new TwelveDataLookupException("Failed to fetch Twelve Data history for symbol: " + symbol, ex);
            }
        }

        return List.of();
    }

    public Optional<BigDecimal> fetchRegularMarketPrice(String symbol) {
        if (!properties.isEnabled() || properties.resolveApiKeys().isEmpty()) {
            return Optional.empty();
        }
        int maxAttempts = Math.max(1, properties.resolveApiKeys().size());
        for (int attempt = 0; attempt < maxAttempts; attempt += 1) {
            Optional<String> maybeApiKey = tryAcquirePermit("price", symbol);
            if (maybeApiKey.isEmpty()) {
                return Optional.empty();
            }
            String apiKey = maybeApiKey.get();

            try {
                String response = restClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .path(PRICE_PATH)
                                .queryParam("symbol", symbol)
                                .queryParam("apikey", apiKey)
                                .build())
                        .retrieve()
                        .body(String.class);
                JsonNode root = objectMapper.readTree(response);

                if ("error".equalsIgnoreCase(text(root, "status"))) {
                    String message = text(root, "message");
                    if (isRateLimitMessage(message)) {
                        activateCooldown("price", symbol, apiKey, message);
                        continue;
                    }
                    throw new TwelveDataLookupException("Twelve Data error: " + message, null);
                }

                return Optional.ofNullable(decimal(text(root, "price")));
            } catch (IOException | RestClientException ex) {
                throw new TwelveDataLookupException("Failed to fetch Twelve Data quote price for symbol: " + symbol, ex);
            }
        }
        return Optional.empty();
    }

    private Optional<String> tryAcquirePermit(String operation, String symbol) {
        int maxRequestsPerMinute = Math.max(1, properties.getMaxRequestsPerMinute());
        Instant now = Instant.now();
        synchronized (rateLimitLock) {
            syncApiKeyStates();
            if (activeApiKeys.isEmpty()) {
                return Optional.empty();
            }

            long epochMinute = now.getEpochSecond() / 60L;
            int keyCount = activeApiKeys.size();
            for (int offset = 0; offset < keyCount; offset += 1) {
                int keyIndex = (nextApiKeyCursor + offset) % keyCount;
                String apiKey = activeApiKeys.get(keyIndex);
                ApiKeyState state = apiKeyStates.get(apiKey);
                if (state == null) {
                    continue;
                }

                if (epochMinute != state.currentEpochMinute) {
                    state.currentEpochMinute = epochMinute;
                    state.requestsInCurrentMinute = 0;
                }

                if (now.isBefore(state.cooldownUntil)) {
                    warnThrottled(operation, symbol, apiKey, "cooldown", state, now);
                    continue;
                }

                if (state.requestsInCurrentMinute >= maxRequestsPerMinute) {
                    Instant nextMinute = Instant.ofEpochSecond((epochMinute + 1L) * 60L);
                    Instant configuredCooldownEnd = now.plus(safeCooldownDuration());
                    state.cooldownUntil = configuredCooldownEnd.isAfter(nextMinute) ? configuredCooldownEnd : nextMinute;
                    warnThrottled(operation, symbol, apiKey, "local-rate-limit", state, now);
                    continue;
                }

                state.requestsInCurrentMinute += 1;
                nextApiKeyCursor = (keyIndex + 1) % keyCount;
                return Optional.of(apiKey);
            }

            warnNoAvailableKeys(operation, symbol, keyCount, now);
            return Optional.empty();
        }
    }

    private Duration safeCooldownDuration() {
        Duration configured = properties.getRateLimitCooldown();
        if (configured == null || configured.isZero() || configured.isNegative()) {
            return Duration.ofSeconds(60);
        }
        return configured;
    }

    private void activateCooldown(String operation, String symbol, String apiKey, String message) {
        Instant now = Instant.now();
        Instant cooldownEnd = now.plus(safeCooldownDuration());
        Instant effectiveCooldownUntil = cooldownEnd;
        synchronized (rateLimitLock) {
            syncApiKeyStates();
            ApiKeyState state = apiKeyStates.computeIfAbsent(apiKey, ignored -> new ApiKeyState());
            if (cooldownEnd.isAfter(state.cooldownUntil)) {
                state.cooldownUntil = cooldownEnd;
            }
            effectiveCooldownUntil = state.cooldownUntil;
            warnThrottled(operation, symbol, apiKey, "provider-rate-limit", state, now);
        }
        log.warn(
                "Twelve Data provider rate limit hit for {} {} (key={}). Cooling down until {}. Message: {}",
                operation,
                symbol,
                redactApiKey(apiKey),
                effectiveCooldownUntil,
                message
        );
    }

    private boolean isRateLimitMessage(String message) {
        if (!StringUtils.hasText(message)) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("run out of api credits")
                || normalized.contains("current limit")
                || normalized.contains("wait for the next minute")
                || normalized.contains("too many requests")
                || normalized.contains("rate limit");
    }

    private void warnThrottled(
            String operation,
            String symbol,
            String apiKey,
            String reason,
            ApiKeyState state,
            Instant now
    ) {
        if (Duration.between(state.lastThrottleWarnAt, now).compareTo(Duration.ofSeconds(10)) < 0) {
            return;
        }
        state.lastThrottleWarnAt = now;
        log.warn(
                "Twelve Data request skipped by {} for {} {} (key={}). minuteCount={}, cooldownUntil={}",
                reason,
                operation,
                symbol,
                redactApiKey(apiKey),
                state.requestsInCurrentMinute,
                state.cooldownUntil
        );
    }

    private void warnNoAvailableKeys(String operation, String symbol, int keyCount, Instant now) {
        if (Duration.between(lastGlobalThrottleWarnAt, now).compareTo(Duration.ofSeconds(10)) < 0) {
            return;
        }
        lastGlobalThrottleWarnAt = now;
        log.warn(
                "Twelve Data request skipped: no available API key for {} {}. keyCount={}",
                operation,
                symbol,
                keyCount
        );
    }

    private void syncApiKeyStates() {
        List<String> resolvedApiKeys = properties.resolveApiKeys();
        if (resolvedApiKeys.equals(activeApiKeys)) {
            return;
        }

        activeApiKeys = resolvedApiKeys;
        apiKeyStates.keySet().retainAll(resolvedApiKeys);
        for (String apiKey : resolvedApiKeys) {
            apiKeyStates.computeIfAbsent(apiKey, ignored -> new ApiKeyState());
        }
        if (activeApiKeys.isEmpty()) {
            nextApiKeyCursor = 0;
            return;
        }
        nextApiKeyCursor = Math.floorMod(nextApiKeyCursor, activeApiKeys.size());
        log.info("Twelve Data API key pool updated. keyCount={}", activeApiKeys.size());
    }

    private String redactApiKey(String apiKey) {
        if (!StringUtils.hasText(apiKey)) {
            return "N/A";
        }
        String trimmed = apiKey.trim();
        if (trimmed.length() <= 4) {
            return trimmed.substring(0, 1) + "***";
        }
        if (trimmed.length() <= 8) {
            return trimmed.substring(0, 2) + "***";
        }
        return trimmed.substring(0, 4) + "***" + trimmed.substring(trimmed.length() - 4);
    }

    private String text(JsonNode node, String fieldName) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? null : value.asText(null);
    }

    private LocalDate parseDate(String rawDateTime) {
        if (!StringUtils.hasText(rawDateTime) || rawDateTime.length() < 10) {
            return null;
        }
        return LocalDate.parse(rawDateTime.substring(0, 10));
    }

    private String normalizeDateTime(String rawDateTime) {
        if (!StringUtils.hasText(rawDateTime)) {
            return null;
        }
        return rawDateTime.trim().replace('T', ' ');
    }

    private int resolveOutputSize(String interval, LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
            return 120;
        }
        long daySpan = ChronoUnit.DAYS.between(startDate, endDate) + 1L;
        long estimated;
        switch (StringUtils.hasText(interval) ? interval.toLowerCase(Locale.ROOT) : "1day") {
            case "1h" -> estimated = daySpan * 24L + 24L;
            case "1week" -> estimated = daySpan / 7L + 10L;
            case "1month" -> estimated = daySpan / 30L + 6L;
            default -> estimated = daySpan + 16L;
        }
        long bounded = Math.max(30L, Math.min(5000L, estimated));
        return (int) bounded;
    }

    private BigDecimal decimal(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        return new BigDecimal(raw.trim());
    }

    public static final class TwelveDataLookupException extends RuntimeException {
        public TwelveDataLookupException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private static final class ApiKeyState {
        private long currentEpochMinute = -1L;
        private int requestsInCurrentMinute = 0;
        private Instant cooldownUntil = Instant.EPOCH;
        private Instant lastThrottleWarnAt = Instant.EPOCH;
    }
}
