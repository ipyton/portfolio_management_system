package com.noah.portfolio.trading;

import java.math.BigDecimal;
import java.util.List;

public record CashAccountBalanceResponse(
        Long userId,
        int count,
        List<CashAccountBalanceItem> items
) {
}

record CashAccountBalanceItem(
        Long cashAccountId,
        String currency,
        BigDecimal balance
) {
}
