package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record TradeHistoryResponse(
        Long userId,
        int count,
        List<TradeHistoryItem> items
) {
}

record TradeHistoryItem(
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
