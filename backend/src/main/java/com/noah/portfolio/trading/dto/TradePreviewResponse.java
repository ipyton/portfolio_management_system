package com.noah.portfolio.trading.dto;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

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
