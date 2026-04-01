package com.noah.portfolio.analytics.controller;

import com.noah.portfolio.analytics.dto.WienerSimulationRequest;
import com.noah.portfolio.analytics.dto.WienerSimulationResponse;
import com.noah.portfolio.analytics.service.PortfolioAnalyticsService;
import com.noah.portfolio.analytics.dto.PortfolioCorrelationResponse;
import com.noah.portfolio.analytics.service.PortfolioCorrelationService;
import com.noah.portfolio.analytics.service.PortfolioSimulationService;

import java.util.Map;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/portfolio")
@Validated
@Tag(name = "Portfolio Dashboard", description = "Portfolio dashboard and benchmark comparison APIs")
public class PortfolioAnalyticsController {

    private final PortfolioAnalyticsService portfolioAnalyticsService;
    private final PortfolioSimulationService portfolioSimulationService;
    private final PortfolioCorrelationService portfolioCorrelationService;

    public PortfolioAnalyticsController(
            PortfolioAnalyticsService portfolioAnalyticsService,
            PortfolioSimulationService portfolioSimulationService,
            PortfolioCorrelationService portfolioCorrelationService
    ) {
        this.portfolioAnalyticsService = portfolioAnalyticsService;
        this.portfolioSimulationService = portfolioSimulationService;
        this.portfolioCorrelationService = portfolioCorrelationService;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Get portfolio dashboard", description = "Returns performance, risk, holdings, trading, and benchmark comparison metrics.")
    public Map<String, Object> getDashboard(
            @Parameter(description = "User ID", example = "1")
            @RequestParam(required = false) Long userId,
            @Parameter(description = "Optional benchmark symbol", example = "SPX")
            @RequestParam(required = false) String benchmarkSymbol,
            @Parameter(description = "Optional reporting currency for holdings and cash aggregation", example = "CNY")
            @RequestParam(required = false) String baseCurrency
    ) {
        return portfolioAnalyticsService.getDashboardSummary(userId, benchmarkSymbol, baseCurrency);
    }

    @PostMapping("/analysis/wiener-simulation")
    @Operation(
            summary = "Run correlated Wiener process simulation",
            description = "Simulates multi-asset GBM paths with correlation via Cholesky decomposition and returns portfolio path statistics."
    )
    public WienerSimulationResponse simulateWienerProcess(
            @Valid @RequestBody WienerSimulationRequest request
    ) {
        return portfolioSimulationService.simulatePortfolio(request);
    }

    @GetMapping("/analysis/correlation")
    @Operation(
            summary = "Evaluate asset correlation to portfolio",
            description = "Computes the Pearson correlation coefficient between asset daily returns and portfolio daily returns."
    )
    public PortfolioCorrelationResponse evaluateCorrelation(
            @Parameter(description = "User ID", example = "1")
            @RequestParam Long userId,
            @Parameter(description = "Asset symbol", example = "AAPL")
            @RequestParam String symbol,
            @Parameter(description = "Lookback days for alignment", example = "120")
            @RequestParam(required = false) Integer days
    ) {
        return portfolioCorrelationService.evaluateCorrelation(userId, symbol, days);
    }
}
