package com.noah.portfolio.asset.controller;

import com.noah.portfolio.asset.client.*;
import com.noah.portfolio.asset.config.*;
import com.noah.portfolio.asset.dto.*;
import com.noah.portfolio.asset.entity.*;
import com.noah.portfolio.asset.model.*;
import com.noah.portfolio.asset.repository.*;
import com.noah.portfolio.asset.service.*;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/assets")
@Tag(name = "Assets", description = "Asset search and detail APIs")
public class AssetSearchController {

    private final AssetSearchService assetSearchService;

    public AssetSearchController(AssetSearchService assetSearchService) {
        this.assetSearchService = assetSearchService;
    }

    @GetMapping("/search")
    @Operation(summary = "Search asset detail", description = "Search the local database first and enrich the result with Finnhub detail.")
    public AssetSearchResponse search(
            @Parameter(description = "Search keyword, typically a symbol or asset name", example = "AAPL")
            @RequestParam("query") String query
    ) {
        return assetSearchService.search(query);
    }

    @GetMapping("/suggestions")
    @Operation(summary = "Suggest assets", description = "Returns autocomplete candidates from local assets and Finnhub.")
    public AssetSuggestionResponse suggest(
            @Parameter(description = "Partial symbol or asset name keyword", example = "App")
            @RequestParam("query") String query,
            @Parameter(description = "Maximum number of suggestions to return", example = "8")
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        return assetSearchService.suggest(query, limit);
    }

    @GetMapping("/recommendations")
    @Operation(summary = "Recommend assets by risk profile", description = "Returns ranked and weighted basket candidates by profile.")
    public AssetRecommendationResponse recommend(
            @Parameter(description = "Risk profile: conservative, balanced, aggressive", example = "balanced")
            @RequestParam("profile") String profile,
            @Parameter(description = "Maximum number of recommendation items", example = "6")
            @RequestParam(name = "limit", required = false) Integer limit,
            @Parameter(description = "Lookback window in days for scoring metrics", example = "180")
            @RequestParam(name = "lookbackDays", required = false) Integer lookbackDays
    ) {
        return assetSearchService.recommend(profile, limit, lookbackDays);
    }

    @GetMapping("/price-history")
    @Operation(summary = "Get asset price history", description = "Returns recent daily close series from database first; A-share symbols use Eastmoney, others use Twelve Data.")
    public AssetPriceHistoryResponse priceHistory(
            @Parameter(description = "Asset symbol or name", example = "AAPL")
            @RequestParam("query") String query,
            @Parameter(description = "Lookback window in days", example = "30")
            @RequestParam(name = "days", required = false) Integer days
    ) {
        return assetSearchService.priceHistory(query, days);
    }

    @GetMapping("/candles")
    @Operation(summary = "Get asset candle history", description = "Returns recent OHLC candles from Twelve Data by interval (1day/1week/1month). Falls back to local close-only candles when Twelve Data is unavailable.")
    public AssetCandleHistoryResponse candles(
            @Parameter(description = "Asset symbol or name", example = "AAPL")
            @RequestParam("query") String query,
            @Parameter(description = "Lookback window in days", example = "60")
            @RequestParam(name = "days", required = false) Integer days,
            @Parameter(description = "Candle interval: 1day, 1week, 1month", example = "1day")
            @RequestParam(name = "interval", required = false) String interval
    ) {
        return assetSearchService.candleHistory(query, days, interval);
    }

    @GetMapping("/world-indices")
    @Operation(summary = "List world indices", description = "Returns world indices configured in local assets table.")
    public AssetWorldIndicesResponse worldIndices() {
        return assetSearchService.worldIndices();
    }
}
