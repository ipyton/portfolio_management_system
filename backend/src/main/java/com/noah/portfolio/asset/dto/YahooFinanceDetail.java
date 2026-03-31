package com.noah.portfolio.asset.dto;

import java.math.BigDecimal;

public record YahooFinanceDetail(
        String symbol,
        String shortName,
        String longName,
        String quoteType,
        String currency,
        String exchange,
        String marketState,
        BigDecimal regularMarketPrice,
        BigDecimal regularMarketChange,
        BigDecimal regularMarketChangePercent,
        Long marketCap,
        BigDecimal trailingPe,
        BigDecimal forwardPe,
        BigDecimal fiftyTwoWeekHigh,
        BigDecimal fiftyTwoWeekLow,
        BigDecimal dividendYield,
        String website,
        String sector,
        String industry,
        String longBusinessSummary,
        String fundFamily,
        String category,
        Long totalAssets
) {
}
