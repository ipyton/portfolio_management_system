package com.noah.portfolio.watchlist;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WatchlistRequest(
        @NotNull Long userId,
        @NotNull Long assetId,
        @Size(max = 255) String note
) {
}
