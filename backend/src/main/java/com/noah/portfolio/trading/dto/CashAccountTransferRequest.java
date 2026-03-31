package com.noah.portfolio.trading.dto;

import com.noah.portfolio.trading.controller.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CashAccountTransferRequest(
        @NotNull Long userId,
        @NotBlank @Size(max = 10) String currency,
        @NotNull @DecimalMin(value = "0.000001") BigDecimal amount,
        @Size(max = 64) String bizId,
        @Size(max = 255) String note
) {
}
