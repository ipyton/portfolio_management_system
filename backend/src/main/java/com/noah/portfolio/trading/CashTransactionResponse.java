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
        String bizId,
        String currency,
        String txType,
        String status,
        BigDecimal amount,
        BigDecimal balanceAfter,
        BigDecimal availableBalanceAfter,
        BigDecimal frozenBalanceAfter,
        Long refTradeId,
        Instant occurredAt,
        String note
) {
}
