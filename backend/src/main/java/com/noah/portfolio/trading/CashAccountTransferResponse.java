package com.noah.portfolio.trading;

import java.math.BigDecimal;

public record CashAccountTransferResponse(
        boolean mock,
        String bizId,
        String txType,
        String status,
        Long userId,
        Long cashAccountId,
        String currency,
        BigDecimal amount,
        BigDecimal balanceBefore,
        BigDecimal balanceAfter,
        BigDecimal availableBalanceBefore,
        BigDecimal availableBalanceAfter,
        BigDecimal frozenBalanceBefore,
        BigDecimal frozenBalanceAfter,
        String note
) {
}
