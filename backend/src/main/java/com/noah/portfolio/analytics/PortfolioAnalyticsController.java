package com.noah.portfolio.analytics;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/portfolio")
@Tag(name = "Portfolio Analytics", description = "Portfolio analytics and benchmark comparison APIs")
public class PortfolioAnalyticsController {

    private final PortfolioAnalyticsService portfolioAnalyticsService;

    public PortfolioAnalyticsController(PortfolioAnalyticsService portfolioAnalyticsService) {
        this.portfolioAnalyticsService = portfolioAnalyticsService;
    }

    @GetMapping("/analytics")
    @Operation(summary = "Get portfolio analytics", description = "Returns performance, risk, holdings, trading, and benchmark comparison metrics.")
    public Map<String, Object> getAnalytics(
            @Parameter(description = "Optional benchmark symbol", example = "SPX")
            @RequestParam(required = false) String benchmarkSymbol
    ) {
        return portfolioAnalyticsService.getAnalyticsSummary(benchmarkSymbol);
    }
}
