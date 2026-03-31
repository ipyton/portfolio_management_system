package com.noah.portfolio.trading.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record TradeHistoryItem(
        Long tradeId,
        String bizId,
        Long holdingId,
        Long assetId,
        String symbol,
        String currency,
        String tradeType,
        String status,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal amount,
        BigDecimal fee,
        BigDecimal holdingQuantityAfter,
        BigDecimal holdingAvgCostAfter,
        Instant tradedAt,
        String note
) {
}
