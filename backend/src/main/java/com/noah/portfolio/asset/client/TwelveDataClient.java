package com.noah.portfolio.asset.client;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

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
import com.noah.portfolio.asset.dto.AssetPriceHistoryItem;

@Component
public class TwelveDataClient {

    private static final String TIME_SERIES_PATH = "/time_series";
    private static final String PRICE_PATH = "/price";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final TwelveDataProperties properties;

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
        if (!properties.isEnabled() || !StringUtils.hasText(properties.getApiKey())) {
            return List.of();
        }

        try {
            String response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path(TIME_SERIES_PATH)
                            .queryParam("symbol", symbol)
                            .queryParam("interval", "1day")
                            .queryParam("outputsize", 120)
                            .queryParam("apikey", properties.getApiKey())
                            .build())
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(response);

            if ("error".equalsIgnoreCase(text(root, "status"))) {
                throw new TwelveDataLookupException("Twelve Data error: " + text(root, "message"), null);
            }

            JsonNode values = root.path("values");
            if (!values.isArray()) {
                return List.of();
            }

            List<AssetPriceHistoryItem> items = new ArrayList<>();
            for (JsonNode value : values) {
                LocalDate tradeDate = parseDate(text(value, "datetime"));
                BigDecimal close = decimal(text(value, "close"));
                if (tradeDate == null || close == null) {
                    continue;
                }
                if (tradeDate.isBefore(startDate) || tradeDate.isAfter(endDate)) {
                    continue;
                }
                items.add(new AssetPriceHistoryItem(tradeDate, close));
            }

            items.sort(Comparator.comparing(AssetPriceHistoryItem::tradeDate));
            return items;
        } catch (IOException | RestClientException ex) {
            throw new TwelveDataLookupException("Failed to fetch Twelve Data history for symbol: " + symbol, ex);
        }
    }

    public Optional<BigDecimal> fetchRegularMarketPrice(String symbol) {
        if (!properties.isEnabled() || !StringUtils.hasText(properties.getApiKey())) {
            return Optional.empty();
        }

        try {
            String response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path(PRICE_PATH)
                            .queryParam("symbol", symbol)
                            .queryParam("apikey", properties.getApiKey())
                            .build())
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(response);

            if ("error".equalsIgnoreCase(text(root, "status"))) {
                throw new TwelveDataLookupException("Twelve Data error: " + text(root, "message"), null);
            }

            return Optional.ofNullable(decimal(text(root, "price")));
        } catch (IOException | RestClientException ex) {
            throw new TwelveDataLookupException("Failed to fetch Twelve Data quote price for symbol: " + symbol, ex);
        }
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
}
