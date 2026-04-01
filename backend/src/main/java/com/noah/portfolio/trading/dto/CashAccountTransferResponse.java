package com.noah.portfolio.trading.dto;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

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
