package com.noah.portfolio.asset;

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
}
