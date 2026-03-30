package com.noah.portfolio.trading;

import java.math.BigDecimal;

public record TradePreviewResponse(
        String tradeType,
        Long userId,
        Long assetId,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal amount,
        BigDecimal fee,
        BigDecimal grossCashImpact,
        String currency,
        String message
) {
}
