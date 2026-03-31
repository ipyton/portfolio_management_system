package com.noah.portfolio.asset.model;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AssetLatestPriceSnapshot(
        Long assetId,
        BigDecimal close,
        LocalDate tradeDate
) {
}
