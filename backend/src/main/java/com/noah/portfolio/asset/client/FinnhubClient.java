package com.noah.portfolio.asset.client;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.math.BigDecimal;
import java.net.URI;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.noah.portfolio.asset.config.FinnhubProperties;
import com.noah.portfolio.asset.dto.AssetPriceHistoryItem;
import com.noah.portfolio.asset.dto.YahooFinanceDetail;
import com.noah.portfolio.asset.dto.YahooFinanceSearchResult;

@Component
public class FinnhubClient {

    private static final Logger log = LoggerFactory.getLogger(FinnhubClient.class);
    private static final String SEARCH_PATH = "/api/v1/search";
    private static final String QUOTE_PATH = "/api/v1/quote";
    private static final String PROFILE_PATH = "/api/v1/stock/profile2";
    private static final String METRIC_PATH = "/api/v1/stock/metric";
    private static final String CANDLE_PATH = "/api/v1/stock/candle";
    private static final String GENERAL_NEWS_PATH = "/api/v1/news";
    private static final String METRIC_ALL = "all";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final FinnhubProperties properties;
    private final Object candleAccessLock = new Object();
    private Instant candleHistoryDisabledUntil = Instant.EPOCH;
    private Instant lastCandleSkipWarnAt = Instant.EPOCH;

    public FinnhubClient(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            FinnhubProperties properties
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

    public Optional<YahooFinanceSearchResult> searchBestMatch(String query) {
        return searchCandidates(query, 5).stream().findFirst();
    }

    public List<YahooFinanceSearchResult> searchCandidates(String query, int limit) {
        if (!isAvailable()) {
            return List.of();
        }

        try {
            JsonNode root = getJson(uriBuilder -> uriBuilder
                    .path(SEARCH_PATH)
                    .queryParam("q", query)
                    .queryParam("token", properties.getApiKey())
                    .build());
            JsonNode results = root.path("result");
            if (!results.isArray()) {
                return List.of();
            }

            int normalizedLimit = Math.max(1, limit);
            List<YahooFinanceSearchResult> candidates = new java.util.ArrayList<>(normalizedLimit);
            Iterator<JsonNode> iterator = results.elements();
            while (iterator.hasNext() && candidates.size() < normalizedLimit) {
                JsonNode item = iterator.next();
                YahooFinanceSearchResult parsed = toSearchResult(item);
                if (parsed != null) {
                    candidates.add(parsed);
                }
            }
            return candidates;
        } catch (IOException | RestClientException ex) {
            throw new FinnhubLookupException("Failed to search Finnhub for query: " + query, ex);
        }
    }

    public Optional<YahooFinanceDetail> fetchDetail(String symbol) {
        if (!isAvailable()) {
            return Optional.empty();
        }

        try {
            JsonNode quote = getJson(uriBuilder -> uriBuilder
                    .path(QUOTE_PATH)
                    .queryParam("symbol", symbol)
                    .queryParam("token", properties.getApiKey())
                    .build());
            JsonNode profile = getJson(uriBuilder -> uriBuilder
                    .path(PROFILE_PATH)
                    .queryParam("symbol", symbol)
                    .queryParam("token", properties.getApiKey())
                    .build());
            JsonNode metricRoot = getJson(uriBuilder -> uriBuilder
                    .path(METRIC_PATH)
                    .queryParam("symbol", symbol)
                    .queryParam("metric", METRIC_ALL)
                    .queryParam("token", properties.getApiKey())
                    .build());
            JsonNode metrics = metricRoot.path("metric");

            BigDecimal regularPrice = decimal(quote, "c");
            if (regularPrice == null) {
                return Optional.empty();
            }

            return Optional.of(new YahooFinanceDetail(
                    symbol.toUpperCase(Locale.ROOT),
                    text(profile, "name"),
                    text(profile, "name"),
                    inferQuoteType(symbol),
                    firstNonBlank(text(profile, "currency"), "USD"),
                    text(profile, "exchange"),
                    quote.path("t").asLong(0L) > 0L ? "REGULAR" : null,
                    regularPrice,
                    decimal(quote, "d"),
                    decimal(quote, "dp"),
                    longValue(profile, "marketCapitalization"),
                    firstNonNull(
                            decimal(metrics, "peBasicExclExtraTTM"),
                            decimal(metrics, "peTTM"),
                            decimal(metrics, "peNormalizedAnnual")
                    ),
                    decimal(metrics, "peNormalizedAnnual"),
                    firstNonNull(decimal(metrics, "52WeekHigh"), decimal(quote, "h")),
                    firstNonNull(decimal(metrics, "52WeekLow"), decimal(quote, "l")),
                    firstNonNull(
                            decimal(metrics, "dividendYieldIndicatedAnnual"),
                            decimal(metrics, "currentDividendYieldTTM")
                    ),
                    text(profile, "weburl"),
                    null,
                    text(profile, "finnhubIndustry"),
                    null,
                    null,
                    null,
                    null
            ));
        } catch (IOException | RestClientException ex) {
            throw new FinnhubLookupException("Failed to fetch Finnhub detail for symbol: " + symbol, ex);
        }
    }

    public Optional<BigDecimal> fetchRegularMarketPrice(String symbol) {
        return fetchDetail(symbol)
                .map(YahooFinanceDetail::regularMarketPrice)
                .filter(price -> price != null);
    }

    public List<AssetPriceHistoryItem> fetchDailyHistory(String symbol, LocalDate startDate, LocalDate endDate) {
        if (!isAvailable()) {
            return List.of();
        }
        if (isCandleHistoryTemporarilyDisabled(symbol)) {
            return List.of();
        }
        try {
            JsonNode root = getJson(uriBuilder -> uriBuilder
                    .path(CANDLE_PATH)
                    .queryParam("symbol", symbol)
                    .queryParam("resolution", "D")
                    .queryParam("from", startDate.atStartOfDay().toEpochSecond(ZoneOffset.UTC))
                    .queryParam("to", endDate.plusDays(1).atStartOfDay().minusSeconds(1).toEpochSecond(ZoneOffset.UTC))
                    .queryParam("token", properties.getApiKey())
                    .build());

            String error = text(root, "error");
            if (StringUtils.hasText(error)) {
                handleCandleError(symbol, error);
                return List.of();
            }

            if (!"ok".equalsIgnoreCase(text(root, "s"))) {
                return List.of();
            }

            JsonNode closes = root.path("c");
            JsonNode times = root.path("t");
            if (!closes.isArray() || !times.isArray()) {
                return List.of();
            }

            int size = Math.min(closes.size(), times.size());
            List<AssetPriceHistoryItem> items = new java.util.ArrayList<>(size);
            for (int i = 0; i < size; i++) {
                JsonNode closeNode = closes.get(i);
                JsonNode timeNode = times.get(i);
                if (closeNode == null || timeNode == null || !closeNode.isNumber() || !timeNode.isNumber()) {
                    continue;
                }
                LocalDate tradeDate = Instant.ofEpochSecond(timeNode.longValue()).atZone(ZoneOffset.UTC).toLocalDate();
                items.add(new AssetPriceHistoryItem(tradeDate, closeNode.decimalValue()));
            }
            return items;
        } catch (RestClientResponseException ex) {
            if (handleCandleHttpStatusError(symbol, ex)) {
                return List.of();
            }
            throw new FinnhubLookupException("Failed to fetch Finnhub history for symbol: " + symbol, ex);
        } catch (IOException | RestClientException ex) {
            throw new FinnhubLookupException("Failed to fetch Finnhub history for symbol: " + symbol, ex);
        }
    }

    private boolean isCandleHistoryTemporarilyDisabled(String symbol) {
        Instant now = Instant.now();
        synchronized (candleAccessLock) {
            if (!now.isBefore(candleHistoryDisabledUntil)) {
                return false;
            }
            if (Duration.between(lastCandleSkipWarnAt, now).compareTo(Duration.ofSeconds(15)) >= 0) {
                lastCandleSkipWarnAt = now;
                log.warn(
                        "Finnhub candle access temporarily disabled until {}. Skipping history request for symbol {}.",
                        candleHistoryDisabledUntil,
                        symbol
                );
            }
            return true;
        }
    }

    private void handleCandleError(String symbol, String errorMessage) {
        String normalized = errorMessage.toLowerCase(Locale.ROOT);
        Instant now = Instant.now();
        Duration disableDuration = null;
        if (normalized.contains("don't have access")
                || normalized.contains("do not have access")
                || normalized.contains("forbidden")
                || normalized.contains("permission")) {
            disableDuration = Duration.ofHours(1);
        } else if (normalized.contains("rate limit") || normalized.contains("too many requests")) {
            disableDuration = Duration.ofMinutes(1);
        }

        if (disableDuration != null) {
            synchronized (candleAccessLock) {
                Instant nextUntil = now.plus(disableDuration);
                if (nextUntil.isAfter(candleHistoryDisabledUntil)) {
                    candleHistoryDisabledUntil = nextUntil;
                }
                lastCandleSkipWarnAt = now;
            }
            log.warn(
                    "Finnhub candle history unavailable for symbol {}. Disabled until {}. Error: {}",
                    symbol,
                    candleHistoryDisabledUntil,
                    errorMessage
            );
            return;
        }

        log.warn("Finnhub candle history returned error for symbol {}: {}", symbol, errorMessage);
    }

    private boolean handleCandleHttpStatusError(String symbol, RestClientResponseException ex) {
        int statusCode = ex.getStatusCode().value();
        String message = StringUtils.hasText(ex.getResponseBodyAsString())
                ? ex.getResponseBodyAsString()
                : ex.getMessage();
        if (statusCode == 401 || statusCode == 403) {
            synchronized (candleAccessLock) {
                Instant nextUntil = Instant.now().plus(Duration.ofHours(1));
                if (nextUntil.isAfter(candleHistoryDisabledUntil)) {
                    candleHistoryDisabledUntil = nextUntil;
                }
                lastCandleSkipWarnAt = Instant.now();
            }
            log.warn(
                    "Finnhub candle history unauthorized for symbol {}. Disabled until {}. status={}, body={}",
                    symbol,
                    candleHistoryDisabledUntil,
                    statusCode,
                    message
            );
            return true;
        }
        if (statusCode == 429) {
            synchronized (candleAccessLock) {
                Instant nextUntil = Instant.now().plus(Duration.ofMinutes(1));
                if (nextUntil.isAfter(candleHistoryDisabledUntil)) {
                    candleHistoryDisabledUntil = nextUntil;
                }
                lastCandleSkipWarnAt = Instant.now();
            }
            log.warn(
                    "Finnhub candle history rate-limited for symbol {}. Disabled until {}. body={}",
                    symbol,
                    candleHistoryDisabledUntil,
                    message
            );
            return true;
        }
        return false;
    }

    public List<NewsHeadline> fetchGeneralNews(String category, int limit) {
        if (!isAvailable()) {
            return List.of();
        }

        String normalizedCategory = StringUtils.hasText(category)
                ? category.trim().toLowerCase(Locale.ROOT)
                : "general";
        int normalizedLimit = Math.max(1, Math.min(limit, 50));

        try {
            JsonNode root = getJson(uriBuilder -> uriBuilder
                    .path(GENERAL_NEWS_PATH)
                    .queryParam("category", normalizedCategory)
                    .queryParam("token", properties.getApiKey())
                    .build());
            if (!root.isArray()) {
                return List.of();
            }

            List<NewsHeadline> headlines = new java.util.ArrayList<>(normalizedLimit);
            Iterator<JsonNode> iterator = root.elements();
            while (iterator.hasNext() && headlines.size() < normalizedLimit) {
                JsonNode item = iterator.next();
                String headline = text(item, "headline");
                String url = text(item, "url");
                if (!StringUtils.hasText(headline) || !StringUtils.hasText(url)) {
                    continue;
                }

                long epochSeconds = item.path("datetime").asLong(0L);
                Instant publishedAt = epochSeconds > 0L ? Instant.ofEpochSecond(epochSeconds) : null;
                headlines.add(new NewsHeadline(
                        text(item, "source"),
                        headline,
                        url,
                        publishedAt
                ));
            }
            return headlines;
        } catch (IOException | RestClientException ex) {
            throw new FinnhubLookupException("Failed to fetch Finnhub general news.", ex);
        }
    }

    private boolean isAvailable() {
        return properties.isEnabled() && StringUtils.hasText(properties.getApiKey());
    }

    private JsonNode getJson(Function<UriBuilder, URI> uriFunction) throws IOException {
        String response = restClient.get()
                .uri(uriFunction)
                .retrieve()
                .body(String.class);
        return objectMapper.readTree(response);
    }

    private String text(JsonNode node, String fieldName) {
        if (isMissing(node)) {
            return null;
        }
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? null : value.asText(null);
    }

    private BigDecimal decimal(JsonNode node, String fieldName) {
        return decimal(isMissing(node) ? null : node.path(fieldName));
    }

    private BigDecimal decimal(JsonNode node) {
        if (isMissing(node)) {
            return null;
        }
        if (node.isNumber()) {
            return node.decimalValue();
        }
        if (node.isTextual() && StringUtils.hasText(node.asText())) {
            return new BigDecimal(node.asText());
        }
        return null;
    }

    private Long longValue(JsonNode node, String fieldName) {
        if (isMissing(node)) {
            return null;
        }
        JsonNode value = node.path(fieldName);
        if (value.isIntegralNumber()) {
            return value.longValue();
        }
        if (value.isNumber()) {
            return value.decimalValue().longValue();
        }
        if (value.isTextual() && StringUtils.hasText(value.asText())) {
            return new BigDecimal(value.asText()).longValue();
        }
        return null;
    }

    private boolean isMissing(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull();
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

    private String inferQuoteType(String symbol) {
        if (!StringUtils.hasText(symbol)) {
            return null;
        }
        String upper = symbol.toUpperCase(Locale.ROOT);
        if (upper.contains("-USD")) {
            return "CRYPTOCURRENCY";
        }
        return "EQUITY";
    }

    private YahooFinanceSearchResult toSearchResult(JsonNode item) {
        String symbol = firstNonBlank(text(item, "displaySymbol"), text(item, "symbol"));
        if (!StringUtils.hasText(symbol)) {
            return null;
        }
        return new YahooFinanceSearchResult(
                symbol.toUpperCase(Locale.ROOT),
                text(item, "description"),
                text(item, "description"),
                text(item, "type"),
                null,
                null
        );
    }

    public static final class FinnhubLookupException extends RuntimeException {
        public FinnhubLookupException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public record NewsHeadline(
            String source,
            String headline,
            String url,
            Instant publishedAt
    ) {
    }
}
