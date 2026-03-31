package com.noah.portfolio.watchlist.dto;

import com.noah.portfolio.watchlist.controller.*;
import com.noah.portfolio.watchlist.entity.*;
import com.noah.portfolio.watchlist.repository.*;
import com.noah.portfolio.watchlist.service.*;

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
