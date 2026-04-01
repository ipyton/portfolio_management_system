package com.noah.portfolio.analytics.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record WienerSimulationRequest(
        @NotNull(message = "assetCount must not be null")
        @Min(value = 1, message = "assetCount must be between 1 and 30")
        @Max(value = 30, message = "assetCount must be between 1 and 30")
        Integer assetCount,
        List<String> symbols,
        @NotEmpty(message = "initialPrices must not be empty")
        List<@NotNull(message = "initialPrices contains null")
        @Positive(message = "initialPrices must be > 0") Double> initialPrices,
        @NotEmpty(message = "annualReturns must not be empty")
        List<@NotNull(message = "annualReturns contains null") Double> annualReturns,
        @NotEmpty(message = "annualVolatilities must not be empty")
        List<@NotNull(message = "annualVolatilities contains null")
        @Positive(message = "annualVolatilities must be > 0") Double> annualVolatilities,
        @NotEmpty(message = "weights must not be empty")
        List<@NotNull(message = "weights contains null") Double> weights,
        @NotEmpty(message = "correlationMatrix must not be empty")
        List<@NotEmpty(message = "correlationMatrix row must not be empty")
        List<@NotNull(message = "correlationMatrix contains null") Double>> correlationMatrix,
        @NotNull(message = "steps must not be null")
        @Min(value = 10, message = "steps must be between 10 and 5000")
        @Max(value = 5000, message = "steps must be between 10 and 5000")
        Integer steps,
        @NotNull(message = "paths must not be null")
        @Min(value = 1, message = "paths must be between 1 and 5000")
        @Max(value = 5000, message = "paths must be between 1 and 5000")
        Integer paths,
        Long seed
) {
}
