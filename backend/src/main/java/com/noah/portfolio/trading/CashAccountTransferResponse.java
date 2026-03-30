package com.noah.portfolio.trading;

import java.math.BigDecimal;

public record CashAccountTransferResponse(
        boolean mock,
        String txType,
        Long userId,
        Long cashAccountId,
        String currency,
        BigDecimal amount,
        BigDecimal balanceBefore,
        BigDecimal balanceAfter,
        String note
) {
}
