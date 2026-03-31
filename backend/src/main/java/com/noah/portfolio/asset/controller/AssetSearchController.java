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
    @Operation(summary = "Search asset detail", description = "Search the local database first and enrich the result with Yahoo Finance detail.")
    public AssetSearchResponse search(
            @Parameter(description = "Search keyword, typically a symbol or asset name", example = "AAPL")
            @RequestParam("query") String query
    ) {
        return assetSearchService.search(query);
    }

    @GetMapping("/suggestions")
    @Operation(summary = "Suggest assets", description = "Returns lightweight local asset candidates for autocomplete.")
    public AssetSuggestionResponse suggest(
            @Parameter(description = "Partial symbol or asset name keyword", example = "App")
            @RequestParam("query") String query,
            @Parameter(description = "Maximum number of suggestions to return", example = "8")
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        return assetSearchService.suggest(query, limit);
    }
}
