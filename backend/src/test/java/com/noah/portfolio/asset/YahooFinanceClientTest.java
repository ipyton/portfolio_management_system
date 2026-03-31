package com.noah.portfolio.asset;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

class YahooFinanceClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private YahooFinanceClient yahooFinanceClient;

    @BeforeEach
    void setUp() {
        YahooFinanceProperties properties = new YahooFinanceProperties();
        properties.setBaseUrl("https://query1.finance.yahoo.com");
        properties.setTimeout(Duration.ofSeconds(2));
        yahooFinanceClient = new YahooFinanceClient(RestClient.builder(), objectMapper, properties);
    }

    @Test
    void buildDetailParsesQuoteAndSummaryPayloads() throws Exception {
        JsonNode quoteRoot = objectMapper.readTree("""
                {
                  "quoteResponse": {
                    "result": [
                      {
                        "symbol": "AAPL",
                        "shortName": "Apple",
                        "longName": "Apple Inc.",
                        "quoteType": "EQUITY",
                        "currency": "USD",
                        "fullExchangeName": "NasdaqGS",
                        "marketState": "REGULAR",
                        "regularMarketPrice": 191.34,
                        "regularMarketChange": 1.22,
                        "regularMarketChangePercent": 0.64,
                        "marketCap": 2000000,
                        "trailingPE": 29.10
                      }
                    ]
                  }
                }
                """);
        JsonNode summaryRoot = objectMapper.readTree("""
                {
                  "quoteSummary": {
                    "result": [
                      {
                        "summaryProfile": {
                          "website": "https://apple.com",
                          "sector": "Technology",
                          "industry": "Consumer Electronics",
                          "longBusinessSummary": "Summary"
                        },
                        "summaryDetail": {
                          "forwardPE": { "raw": 27.4 },
                          "fiftyTwoWeekHigh": { "raw": 210.0 },
                          "fiftyTwoWeekLow": { "raw": 160.0 },
                          "dividendYield": { "raw": 0.0045 }
                        }
                      }
                    ]
                  }
                }
                """);

        YahooFinanceDetail detail = yahooFinanceClient.buildDetail("AAPL", quoteRoot, summaryRoot).orElseThrow();

        assertThat(detail.symbol()).isEqualTo("AAPL");
        assertThat(detail.exchange()).isEqualTo("NasdaqGS");
        assertThat(detail.regularMarketPrice()).isEqualByComparingTo(new BigDecimal("191.34"));
        assertThat(detail.forwardPe()).isEqualByComparingTo(new BigDecimal("27.4"));
        assertThat(detail.sector()).isEqualTo("Technology");
    }
}
