package com.noah.portfolio.analytics.dto;

import java.util.List;

public record WienerSimulationResponse(
        Integer assetCount,
        Integer steps,
        Integer paths,
        Double dt,
        Double initialPortfolioValue,
        List<String> symbols,
        List<PortfolioPoint> meanPath,
        List<PortfolioPath> samplePaths,
        SimulationStats stats,
        List<String> warnings
) {
    public record PortfolioPoint(Integer step, Double time, Double value) {
    }

    public record PortfolioPath(Integer pathIndex, List<PortfolioPoint> points) {
    }

    public record SimulationStats(
            Double expectedReturn,
            Double annualizedVolatility,
            Double var95,
            Double var99,
            Double cvar95
    ) {
    }
}
