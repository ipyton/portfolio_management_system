package com.noah.portfolio.watchlist.dto;

import com.noah.portfolio.watchlist.controller.*;
import com.noah.portfolio.watchlist.entity.*;
import com.noah.portfolio.watchlist.repository.*;
import com.noah.portfolio.watchlist.service.*;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WatchlistRequest(
        @NotNull Long userId,
        Long assetId,
        @Size(max = 30) String symbol,
        @Size(max = 100) String name,
        @Size(max = 10) String currency,
        @Size(max = 255) String exchange,
        @Size(max = 255) String region,
        @Size(max = 255) String note
) {
}
