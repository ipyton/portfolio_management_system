package com.noah.portfolio.asset.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StockSearchItem(
        Long assetId,
        String symbol,
        String name,
        String currency,
        String exchange,
        String region,
        String sector,
        String industry,
        Long marketCap,
        BigDecimal peRatio,
        BigDecimal latestClose,
        LocalDate latestTradeDate
) {
}
