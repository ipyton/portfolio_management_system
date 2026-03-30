package com.noah.portfolio.trading;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CashAccountTransferRequest(
        @NotNull Long userId,
        @NotBlank @Size(max = 10) String currency,
        @NotNull @DecimalMin(value = "0.000001") BigDecimal amount,
        @Size(max = 255) String note
) {
}
