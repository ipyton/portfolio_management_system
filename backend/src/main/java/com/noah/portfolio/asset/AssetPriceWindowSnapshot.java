package com.noah.portfolio.asset;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AssetPriceWindowSnapshot(
        Long assetId,
        BigDecimal latestClose,
        LocalDate latestTradeDate,
        BigDecimal previousClose,
        LocalDate previousTradeDate
) {
}
