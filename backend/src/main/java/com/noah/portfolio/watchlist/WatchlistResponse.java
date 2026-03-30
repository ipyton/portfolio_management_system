package com.noah.portfolio.watchlist;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record WatchlistResponse(
        Long userId,
        int count,
        List<WatchlistItem> items
) {
}

record WatchlistItem(
        Long watchlistId,
        Long assetId,
        String symbol,
        String name,
        String currency,
        String exchange,
        String region,
        BigDecimal latestClose,
        LocalDate latestTradeDate,
        BigDecimal dailyChange,
        BigDecimal dailyChangePercent,
        Instant addedAt,
        String note
) {
}
