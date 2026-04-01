package com.noah.portfolio.analytics.dto;

import java.util.List;

public record PortfolioCorrelationResponse(
        Long userId,
        String symbol,
        Integer requestedDays,
        Integer alignedObservations,
        Double correlation,
        String riskHint,
        List<CorrelationPoint> points,
        List<String> warnings
) {
    public record CorrelationPoint(
            String date,
            Double portfolioReturn,
            Double assetReturn
    ) {
    }
}
