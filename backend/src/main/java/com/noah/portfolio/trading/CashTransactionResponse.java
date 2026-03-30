package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record CashTransactionResponse(
        Long userId,
        String currency,
        int count,
        List<CashTransactionItem> items
) {
}

record CashTransactionItem(
        Long transactionId,
        String currency,
        String txType,
        BigDecimal amount,
        BigDecimal balanceAfter,
        Long refTradeId,
        Instant occurredAt,
        String note
) {
}
