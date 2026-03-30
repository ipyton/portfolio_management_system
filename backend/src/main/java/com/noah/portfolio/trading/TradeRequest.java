package com.noah.portfolio.trading;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TradeRequest(
        @NotNull Long userId,
        @NotNull Long assetId,
        @NotNull @DecimalMin(value = "0.000001") BigDecimal quantity,
        @NotNull @DecimalMin(value = "0.000001") BigDecimal price,
        @DecimalMin(value = "0.0") BigDecimal fee,
        @Size(max = 255) String note
) {
}
