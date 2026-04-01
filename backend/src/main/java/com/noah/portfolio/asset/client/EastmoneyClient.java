package com.noah.portfolio.asset.client;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.noah.portfolio.asset.config.EastmoneyProperties;
import com.noah.portfolio.asset.dto.AssetPriceHistoryItem;

@Component
public class EastmoneyClient {

    private static final String KLINE_PATH = "/api/qt/stock/kline/get";
    private static final String UT_TOKEN = "fa5fd1943c7b386f172d6893dbfba10b";
    private static final DateTimeFormatter BASIC_DATE = DateTimeFormatter.BASIC_ISO_DATE;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final EastmoneyProperties properties;

    public EastmoneyClient(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            EastmoneyProperties properties
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
                .defaultHeader(HttpHeaders.USER_AGENT, "Mozilla/5.0")
                .build();
    }

    public boolean supportsSymbol(String symbol) {
        return toSecId(symbol) != null;
    }

    public List<AssetPriceHistoryItem> fetchDailyHistory(String symbol, LocalDate startDate, LocalDate endDate) {
        if (!properties.isEnabled()) {
            return List.of();
        }

        String secId = toSecId(symbol);
        if (secId == null) {
            return List.of();
        }

        try {
            String response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path(KLINE_PATH)
                            .queryParam("secid", secId)
                            .queryParam("klt", "101")
                            .queryParam("fqt", "1")
                            .queryParam("beg", startDate.format(BASIC_DATE))
                            .queryParam("end", endDate.format(BASIC_DATE))
                            .queryParam("fields1", "f1,f2,f3,f4,f5,f6")
                            .queryParam("fields2", "f51,f52,f53,f54,f55,f56,f57,f58")
                            .queryParam("ut", UT_TOKEN)
                            .build())
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(response);
            JsonNode data = root.path("data");
            JsonNode klines = data.path("klines");
            if (!klines.isArray()) {
                return List.of();
            }

            List<AssetPriceHistoryItem> items = new ArrayList<>();
            for (JsonNode kline : klines) {
                if (kline == null || !kline.isTextual()) {
                    continue;
                }
                String[] fields = kline.asText().split(",");
                if (fields.length < 3) {
                    continue;
                }
                LocalDate tradeDate = parseDate(fields[0]);
                BigDecimal close = parseDecimal(fields[2]);
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
            throw new EastmoneyLookupException("Failed to fetch Eastmoney history for symbol: " + symbol, ex);
        }
    }

    private String toSecId(String symbol) {
        if (!StringUtils.hasText(symbol)) {
            return null;
        }
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        if (normalized.matches("^\\d{6}\\.(SH|SS)$")) {
            return "1." + normalized.substring(0, 6);
        }
        if (normalized.matches("^\\d{6}\\.SZ$")) {
            return "0." + normalized.substring(0, 6);
        }
        if (normalized.matches("^\\d{6}$")) {
            if (normalized.startsWith("6") || normalized.startsWith("5") || normalized.startsWith("9")) {
                return "1." + normalized;
            }
            if (normalized.startsWith("0") || normalized.startsWith("2") || normalized.startsWith("3")) {
                return "0." + normalized;
            }
        }
        return null;
    }

    private LocalDate parseDate(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String normalized = raw.trim();
        if (normalized.length() >= 10) {
            normalized = normalized.substring(0, 10);
        }
        return LocalDate.parse(normalized);
    }

    private BigDecimal parseDecimal(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        return new BigDecimal(raw.trim());
    }

    public static final class EastmoneyLookupException extends RuntimeException {
        public EastmoneyLookupException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
