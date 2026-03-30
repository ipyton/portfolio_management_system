package com.noah.portfolio.watchlist;

import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@Validated
@RequestMapping("/api/watchlists")
@Tag(name = "Watchlist", description = "Watchlist management APIs")
public class WatchlistController {

    private final WatchlistService watchlistService;

    public WatchlistController(WatchlistService watchlistService) {
        this.watchlistService = watchlistService;
    }

    @GetMapping
    @Operation(summary = "Get watchlist", description = "Returns the watchlist for a user.")
    public WatchlistResponse getWatchlist(
            @Parameter(description = "User ID", example = "1")
            @RequestParam Long userId
    ) {
        return watchlistService.getWatchlist(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add stock to watchlist", description = "Adds a stock asset to the user's watchlist.")
    public WatchlistItem addToWatchlist(@Valid @RequestBody WatchlistRequest request) {
        return watchlistService.addToWatchlist(request);
    }

    @DeleteMapping("/{assetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove stock from watchlist", description = "Removes a stock asset from the user's watchlist.")
    public void removeFromWatchlist(
            @PathVariable Long assetId,
            @Parameter(description = "User ID", example = "1")
            @RequestParam Long userId
    ) {
        watchlistService.removeFromWatchlist(userId, assetId);
    }
}
