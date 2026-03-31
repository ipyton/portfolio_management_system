package com.noah.portfolio.trading.dto;

import java.math.BigDecimal;

public record CashAccountBalanceItem(
        Long cashAccountId,
        String currency,
        BigDecimal balance,
        BigDecimal availableBalance,
        BigDecimal frozenBalance
) {
}
