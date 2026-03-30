package com.noah.portfolio.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record StockSearchResponse(
        String keyword,
        int count,
        List<StockSearchItem> items
) {
}

record StockSearchItem(
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
