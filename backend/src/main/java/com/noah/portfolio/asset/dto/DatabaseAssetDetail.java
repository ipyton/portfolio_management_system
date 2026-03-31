package com.noah.portfolio.asset.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DatabaseAssetDetail(
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
