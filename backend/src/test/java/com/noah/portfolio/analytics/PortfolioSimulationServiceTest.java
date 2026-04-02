package com.noah.portfolio.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.noah.portfolio.analytics.dto.WienerSimulationRequest;
import com.noah.portfolio.analytics.dto.WienerSimulationResponse;
import com.noah.portfolio.analytics.service.PortfolioSimulationService;

class PortfolioSimulationServiceTest {

    @Test
    void simulatePortfolioUsesCapitalWeightsInsteadOfRawPriceAverages() {
        PortfolioSimulationService service = new PortfolioSimulationService();
        WienerSimulationRequest request = new WienerSimulationRequest(
                2,
                List.of("LOW", "HIGH"),
                List.of(10.0, 100.0),
                List.of(Math.log(2.0), 0.0),
                List.of(0.0, 0.0),
                List.of(0.5, 0.5),
                List.of(
                        List.of(1.0, 0.0),
                        List.of(0.0, 1.0)
                ),
                252,
                1,
                42L
        );

        WienerSimulationResponse response = service.simulatePortfolio(request);

        double initial = response.initialPortfolioValue();
        double terminal = response.meanPath().get(response.meanPath().size() - 1).value();
        double expectedTerminal = initial * 1.5;

        assertThat(terminal).isCloseTo(expectedTerminal, within(1e-6));
        assertThat(response.stats().expectedReturn()).isCloseTo(0.5, within(1e-6));
        assertThat(response.warnings()).anyMatch(item -> item.contains("Student-t"));
    }

    @Test
    void simulatePortfolioTreatsStepsAsTradingDays() {
        PortfolioSimulationService service = new PortfolioSimulationService();
        WienerSimulationRequest request = new WienerSimulationRequest(
                1,
                List.of("ONE"),
                List.of(100.0),
                List.of(Math.log(2.0)),
                List.of(0.0),
                List.of(1.0),
                List.of(List.of(1.0)),
                126,
                1,
                7L
        );

        WienerSimulationResponse response = service.simulatePortfolio(request);

        double expectedTerminal = 100.0 * Math.pow(2.0, 0.5);
        assertThat(response.dt()).isCloseTo(1.0 / 252.0, within(1e-6));
        assertThat(response.meanPath().get(response.meanPath().size() - 1).time()).isCloseTo(0.5, within(1e-6));
        assertThat(response.meanPath().get(response.meanPath().size() - 1).value()).isCloseTo(expectedTerminal, within(1e-6));
        assertThat(response.stats().expectedReturn()).isCloseTo(Math.pow(2.0, 0.5) - 1.0, within(1e-6));
        assertThat(response.stats().annualizedVolatility()).isCloseTo(0.0, within(1e-6));
    }
}
