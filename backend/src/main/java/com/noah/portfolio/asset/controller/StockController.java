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
@RequestMapping("/api/stocks")
@Tag(name = "Stocks", description = "Stock search APIs")
public class StockController {

    private final StockSearchService stockSearchService;

    public StockController(StockSearchService stockSearchService) {
        this.stockSearchService = stockSearchService;
    }

    @GetMapping("/search")
    @Operation(summary = "Search stocks", description = "Searches stock assets by symbol or name keyword.")
    public StockSearchResponse search(
            @Parameter(description = "Keyword for stock symbol or name", example = "Apple")
            @RequestParam("keyword") String keyword
    ) {
        return stockSearchService.search(keyword);
    }
}
