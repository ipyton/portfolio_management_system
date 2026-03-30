package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record HoldingResponse(
        Long userId,
        int count,
        List<HoldingItem> items
) {
}

record HoldingItem(
        Long holdingId,
        Long assetId,
        String symbol,
        String name,
        String currency,
        BigDecimal quantity,
        BigDecimal avgCost,
        BigDecimal latestClose,
        LocalDate latestTradeDate,
        BigDecimal dailyChange,
        BigDecimal dailyChangePercent,
        BigDecimal marketValue,
        BigDecimal unrealizedPnl
) {
}
