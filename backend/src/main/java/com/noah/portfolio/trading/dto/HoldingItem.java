package com.noah.portfolio.trading.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record HoldingItem(
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
