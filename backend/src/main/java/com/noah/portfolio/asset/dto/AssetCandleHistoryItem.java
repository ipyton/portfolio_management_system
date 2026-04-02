package com.noah.portfolio.asset.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AssetCandleHistoryItem(
        LocalDate tradeDate,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close
) {
}
