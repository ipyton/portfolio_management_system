package com.noah.portfolio.trading;

import java.math.BigDecimal;

public record TradeResponse(
        Long tradeId,
        String tradeType,
        Long userId,
        Long assetId,
        String symbol,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal amount,
        BigDecimal fee,
        BigDecimal holdingQuantity,
        BigDecimal holdingAvgCost,
        BigDecimal cashBalance,
        String currency,
        String note
) {
}
