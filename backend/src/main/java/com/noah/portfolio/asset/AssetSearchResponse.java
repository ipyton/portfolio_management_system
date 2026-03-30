package com.noah.portfolio.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AssetSearchResponse(
        String query,
        String matchedSource,
        String resolvedSymbol,
        DatabaseAssetDetail database,
        YahooFinanceDetail yahooFinance,
        List<AssetCandidate> databaseMatches,
        List<String> warnings
) {
}

record DatabaseAssetDetail(
        Long assetId,
        String symbol,
        String name,
        String assetType,
        String currency,
        String exchange,
        String region,
        Boolean benchmark,
        String sector,
        String industry,
        Long marketCap,
        BigDecimal peRatio,
        String fundFamily,
        BigDecimal expenseRatio,
        String benchmarkSymbol,
        String fundType,
        BigDecimal nav,
        String underlying,
        LocalDate expiryDate,
        BigDecimal contractSize,
        BigDecimal marginRate,
        String chain,
        String contractAddress,
        String coingeckoId,
        String issuer,
        String bondType,
        BigDecimal faceValue,
        BigDecimal couponRate,
        LocalDate maturityDate,
        BigDecimal latestDbPrice,
        LocalDate latestDbTradeDate
) {
}

record AssetCandidate(
        Long assetId,
        String symbol,
        String name,
        String assetType,
        String exchange,
        String region
) {
}

record YahooFinanceDetail(
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

record YahooFinanceSearchResult(
        String symbol,
        String shortName,
        String longName,
        String quoteType,
        String exchange,
        String region
) {
}
