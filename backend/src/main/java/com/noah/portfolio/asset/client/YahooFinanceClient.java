package com.noah.portfolio.asset.client;

import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.controller.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.util.Iterator;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class YahooFinanceClient {

    private static final String SEARCH_PATH = "/v1/finance/search";
    private static final String QUOTE_PATH = "/v7/finance/quote";
    private static final String QUOTE_SUMMARY_PATH = "/v10/finance/quoteSummary/{symbol}";
    private static final String QUOTE_SUMMARY_MODULES = "price,summaryProfile,summaryDetail,defaultKeyStatistics,financialData,fundProfile";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final YahooFinanceProperties properties;

    public YahooFinanceClient(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            YahooFinanceProperties properties
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
                .defaultHeader(HttpHeaders.USER_AGENT, properties.getUserAgent())
                .build();
    }

    public Optional<YahooFinanceSearchResult> searchBestMatch(String query) {
        if (!properties.isEnabled()) {
            return Optional.empty();
        }

        try {
            JsonNode root = getJson(uriBuilder -> uriBuilder
                    .path(SEARCH_PATH)
                    .queryParam("q", query)
                    .queryParam("quotesCount", 5)
                    .queryParam("newsCount", 0)
                    .build());
            JsonNode quotes = root.path("quotes");
            if (!quotes.isArray()) {
                return Optional.empty();
            }

            Iterator<JsonNode> iterator = quotes.elements();
            while (iterator.hasNext()) {
                JsonNode quote = iterator.next();
                String symbol = text(quote, "symbol");
                if (!StringUtils.hasText(symbol)) {
                    continue;
                }
                return Optional.of(new YahooFinanceSearchResult(
                        symbol,
                        firstNonBlank(text(quote, "shortname"), text(quote, "shortName")),
                        firstNonBlank(text(quote, "longname"), text(quote, "longName")),
                        text(quote, "quoteType"),
                        firstNonBlank(text(quote, "exchDisp"), text(quote, "exchange")),
                        firstNonBlank(text(quote, "region"), text(quote, "exchangeTimezoneName"))
                ));
            }
            return Optional.empty();
        } catch (IOException | RestClientException ex) {
            throw new YahooFinanceLookupException("Failed to search Yahoo Finance for query: " + query, ex);
        }
    }

    public Optional<YahooFinanceDetail> fetchDetail(String symbol) {
        if (!properties.isEnabled()) {
            return Optional.empty();
        }

        try {
            JsonNode quoteRoot = getJson(uriBuilder -> uriBuilder
                    .path(QUOTE_PATH)
                    .queryParam("symbols", symbol)
                    .build());
            JsonNode summaryRoot = getJson(uriBuilder -> uriBuilder
                    .path(QUOTE_SUMMARY_PATH)
                    .queryParam("modules", QUOTE_SUMMARY_MODULES)
                    .build(symbol));
            return buildDetail(symbol, quoteRoot, summaryRoot);
        } catch (IOException | RestClientException ex) {
            throw new YahooFinanceLookupException("Failed to fetch Yahoo Finance detail for symbol: " + symbol, ex);
        }
    }

    public Optional<BigDecimal> fetchRegularMarketPrice(String symbol) {
        if (!properties.isEnabled()) {
            return Optional.empty();
        }

        try {
            JsonNode quoteRoot = getJson(uriBuilder -> uriBuilder
                    .path(QUOTE_PATH)
                    .queryParam("symbols", symbol)
                    .build());
            JsonNode quote = findQuoteNode(quoteRoot.path("quoteResponse").path("result"), symbol);
            return Optional.ofNullable(decimal(quote, "regularMarketPrice"));
        } catch (IOException | RestClientException ex) {
            throw new YahooFinanceLookupException("Failed to fetch Yahoo Finance quote price for symbol: " + symbol, ex);
        }
    }

    Optional<YahooFinanceDetail> buildDetail(String symbol, JsonNode quoteRoot, JsonNode summaryRoot) {
        JsonNode quote = findQuoteNode(quoteRoot.path("quoteResponse").path("result"), symbol);
        JsonNode summaryResult = firstArrayElement(summaryRoot.path("quoteSummary").path("result"));
        JsonNode price = isMissing(summaryResult) ? null : summaryResult.path("price");
        JsonNode summaryProfile = isMissing(summaryResult) ? null : summaryResult.path("summaryProfile");
        JsonNode summaryDetail = isMissing(summaryResult) ? null : summaryResult.path("summaryDetail");
        JsonNode defaultKeyStatistics = isMissing(summaryResult) ? null : summaryResult.path("defaultKeyStatistics");
        JsonNode financialData = isMissing(summaryResult) ? null : summaryResult.path("financialData");
        JsonNode fundProfile = isMissing(summaryResult) ? null : summaryResult.path("fundProfile");

        if (isMissing(quote) && isMissing(summaryResult)) {
            return Optional.empty();
        }

        return Optional.of(new YahooFinanceDetail(
                symbol.toUpperCase(Locale.ROOT),
                firstNonBlank(text(quote, "shortName"), text(price, "shortName")),
                firstNonBlank(text(quote, "longName"), text(price, "longName")),
                firstNonBlank(text(quote, "quoteType"), text(price, "quoteType")),
                firstNonBlank(text(quote, "currency"), text(price, "currency")),
                firstNonBlank(text(quote, "fullExchangeName"), text(quote, "exchange"), text(price, "exchangeName")),
                firstNonBlank(text(quote, "marketState"), text(price, "marketState")),
                firstNonNull(decimal(quote, "regularMarketPrice"), decimal(price, "regularMarketPrice"), decimal(financialData, "currentPrice")),
                firstNonNull(decimal(quote, "regularMarketChange"), decimal(price, "regularMarketChange")),
                firstNonNull(decimal(quote, "regularMarketChangePercent"), decimal(price, "regularMarketChangePercent")),
                firstNonNull(longValue(quote, "marketCap"), longValue(price, "marketCap"), longValue(defaultKeyStatistics, "marketCap")),
                firstNonNull(decimal(quote, "trailingPE"), decimal(summaryDetail, "trailingPE")),
                decimal(summaryDetail, "forwardPE"),
                decimal(summaryDetail, "fiftyTwoWeekHigh"),
                decimal(summaryDetail, "fiftyTwoWeekLow"),
                decimal(summaryDetail, "dividendYield"),
                text(summaryProfile, "website"),
                text(summaryProfile, "sector"),
                text(summaryProfile, "industry"),
                text(summaryProfile, "longBusinessSummary"),
                text(fundProfile, "family"),
                text(fundProfile, "categoryName"),
                longValue(fundProfile, "totalAssets")
        ));
    }

    private JsonNode getJson(Function<UriBuilder, URI> uriFunction) throws IOException {
        String response = restClient.get()
                .uri(uriFunction)
                .retrieve()
                .body(String.class);
        return objectMapper.readTree(response);
    }

    private JsonNode findQuoteNode(JsonNode quotes, String symbol) {
        if (!quotes.isArray()) {
            return null;
        }

        Iterator<JsonNode> iterator = quotes.elements();
        while (iterator.hasNext()) {
            JsonNode candidate = iterator.next();
            if (symbol.equalsIgnoreCase(text(candidate, "symbol"))) {
                return candidate;
            }
        }
        return firstArrayElement(quotes);
    }

    private JsonNode firstArrayElement(JsonNode arrayNode) {
        return arrayNode != null && arrayNode.isArray() && !arrayNode.isEmpty() ? arrayNode.get(0) : null;
    }

    private boolean isMissing(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull();
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
        JsonNode raw = node.has("raw") ? node.path("raw") : node;
        if (raw.isNumber()) {
            return raw.decimalValue();
        }
        if (raw.isTextual() && StringUtils.hasText(raw.asText())) {
            return new BigDecimal(raw.asText());
        }
        return null;
    }

    private Long longValue(JsonNode node, String fieldName) {
        return longValue(isMissing(node) ? null : node.path(fieldName));
    }

    private Long longValue(JsonNode node) {
        if (isMissing(node)) {
            return null;
        }
        JsonNode raw = node.has("raw") ? node.path("raw") : node;
        if (raw.isIntegralNumber()) {
            return raw.longValue();
        }
        if (raw.isNumber()) {
            return raw.decimalValue().longValue();
        }
        if (raw.isTextual() && StringUtils.hasText(raw.asText())) {
            return new BigDecimal(raw.asText()).longValue();
        }
        return null;
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

    public static final class YahooFinanceLookupException extends RuntimeException {
        public YahooFinanceLookupException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
