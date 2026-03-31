package com.noah.portfolio.trading.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record CashTransactionItem(
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
