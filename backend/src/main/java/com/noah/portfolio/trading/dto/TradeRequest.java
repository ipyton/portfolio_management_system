package com.noah.portfolio.trading.dto;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TradeRequest(
        @NotNull Long userId,
        @NotNull Long assetId,
        @NotNull @DecimalMin(value = "0.000001") BigDecimal quantity,
        @NotNull @DecimalMin(value = "0.000001") BigDecimal price,
        @Size(max = 64) String bizId,
        @DecimalMin(value = "0.0") BigDecimal fee,
        @Size(max = 255) String note
) {
}
