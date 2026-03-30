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
        Long holdingId,
        Long assetId,
        String symbol,
        String currency,
        String tradeType,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal amount,
        BigDecimal fee,
        Instant tradedAt,
        String note
) {
}
