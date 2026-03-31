package com.noah.portfolio.asset.dto;

public record YahooFinanceSearchResult(
        String symbol,
        String shortName,
        String longName,
        String quoteType,
        String exchange,
        String region
) {
}
