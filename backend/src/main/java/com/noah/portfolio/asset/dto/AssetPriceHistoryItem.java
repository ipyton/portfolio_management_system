package com.noah.portfolio.asset.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AssetPriceHistoryItem(
        LocalDate tradeDate,
        BigDecimal close
) {
}
