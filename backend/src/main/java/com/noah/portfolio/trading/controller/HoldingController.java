package com.noah.portfolio.trading.controller;

import com.noah.portfolio.trading.dto.*;
import com.noah.portfolio.trading.entity.*;
import com.noah.portfolio.trading.model.*;
import com.noah.portfolio.trading.repository.*;
import com.noah.portfolio.trading.service.*;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/holdings")
@Tag(name = "Holdings", description = "Current user holdings APIs")
public class HoldingController {

    private final TradingService tradingService;

    public HoldingController(TradingService tradingService) {
        this.tradingService = tradingService;
    }

    @GetMapping
    @Operation(summary = "Get holdings", description = "Returns the current holdings for a user with market value and daily change.")
    public HoldingResponse getHoldings(
            @Parameter(description = "User ID", example = "1")
            @RequestParam Long userId
    ) {
        return tradingService.getHoldings(userId);
    }
}
