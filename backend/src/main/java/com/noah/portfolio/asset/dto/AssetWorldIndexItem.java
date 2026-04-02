package com.noah.portfolio.asset.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record AssetWorldIndexItem(
        String symbol,
        String name,
        String region,
        String exchange,
        String currency,
        LocalDate latestTradeDate,
        BigDecimal latestClose,
        BigDecimal previousClose,
        Instant lastRefreshedAt
) {
}
