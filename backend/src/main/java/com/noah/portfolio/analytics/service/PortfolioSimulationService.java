package com.noah.portfolio.analytics.service;

import com.noah.portfolio.analytics.dto.WienerSimulationRequest;
import com.noah.portfolio.analytics.dto.WienerSimulationResponse;
import com.noah.portfolio.analytics.dto.WienerSimulationResponse.PortfolioPath;
import com.noah.portfolio.analytics.dto.WienerSimulationResponse.PortfolioPoint;
import com.noah.portfolio.analytics.dto.WienerSimulationResponse.SimulationStats;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PortfolioSimulationService {

    private static final double EPSILON = 1e-10;
    private static final int DEFAULT_SAMPLE_PATHS = 8;
    private static final int STUDENT_T_DEGREES_OF_FREEDOM = 6;
    private static final double TRADING_DAYS_PER_YEAR = 252.0;

    public WienerSimulationResponse simulatePortfolio(WienerSimulationRequest request) {
        int n = request.assetCount();
        int steps = request.steps();
        int paths = request.paths();

        validateDimensions(request, n);

        double[] initialPrices = toArray(request.initialPrices());
        double[] annualReturns = toArray(request.annualReturns());
        double[] annualVolatilities = toArray(request.annualVolatilities());
        double[] rawWeights = toArray(request.weights());
        double rawWeightSum = sum(rawWeights);
        double[] weights = normalizeWeights(rawWeights);
        double[][] corr = toMatrix(request.correlationMatrix(), n);
        validateCorrelationMatrix(corr);

        double[][] cholesky = choleskyWithJitter(corr);
        double dt = 1.0 / TRADING_DAYS_PER_YEAR;
        double sqrtDt = Math.sqrt(dt);
        double horizonYears = steps / TRADING_DAYS_PER_YEAR;

        List<String> symbols = normalizeSymbols(request.symbols(), n);
        List<double[]> simulatedPaths = new ArrayList<>(paths);
        Random random = request.seed() == null ? new Random() : new Random(request.seed());
        double initialPortfolioValue = weightedPriceValue(initialPrices, weights);
        if (Math.abs(initialPortfolioValue) <= EPSILON) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Initial portfolio value is near zero; check prices and weights.");
        }
        double[] positionUnits = buildPositionUnits(initialPrices, weights, initialPortfolioValue);

        for (int path = 0; path < paths; path++) {
            double[] portfolioSeries = new double[steps + 1];
            double[] prices = initialPrices.clone();
            portfolioSeries[0] = initialPortfolioValue;

            for (int step = 1; step <= steps; step++) {
                double[] z = new double[n];
                for (int i = 0; i < n; i++) {
                    z[i] = random.nextGaussian();
                }

                double[] correlated = matVec(cholesky, z);
                double tScale = studentTScale(random, STUDENT_T_DEGREES_OF_FREEDOM);
                for (int i = 0; i < n; i++) {
                    double drift = (annualReturns[i] - 0.5 * annualVolatilities[i] * annualVolatilities[i]) * dt;
                    double diffusion = annualVolatilities[i] * sqrtDt * correlated[i] * tScale;
                    prices[i] = prices[i] * Math.exp(drift + diffusion);
                }

                portfolioSeries[step] = portfolioValue(prices, positionUnits);
            }

            simulatedPaths.add(portfolioSeries);
        }

        List<PortfolioPoint> meanPath = buildMeanPath(simulatedPaths, steps, paths, dt);
        List<PortfolioPath> samplePaths = buildSamplePaths(simulatedPaths, steps, dt);
        SimulationStats stats = buildStats(simulatedPaths, initialPortfolioValue, steps, horizonYears);

        List<String> warnings = new ArrayList<>();
        if (!approximatelyOne(rawWeightSum, 1e-8)) {
            warnings.add("Input weights were normalized to sum to 1.");
        }
        warnings.add("GBM simulation uses standardized Student-t shocks (df=" + STUDENT_T_DEGREES_OF_FREEDOM
                + "), daily dt=1/252, constant annual drift/volatility, and static correlation.");

        return new WienerSimulationResponse(
                n,
                steps,
                paths,
                round(dt),
                round(initialPortfolioValue),
                symbols,
                meanPath,
                samplePaths,
                stats,
                warnings
        );
    }

    private void validateDimensions(WienerSimulationRequest request, int n) {
        if (request.initialPrices().size() != n) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "initialPrices size must equal assetCount.");
        }
        if (request.annualReturns().size() != n) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "annualReturns size must equal assetCount.");
        }
        if (request.annualVolatilities().size() != n) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "annualVolatilities size must equal assetCount.");
        }
        if (request.weights().size() != n) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weights size must equal assetCount.");
        }
        if (request.correlationMatrix().size() != n) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correlationMatrix row count must equal assetCount.");
        }
    }

    private double[] normalizeWeights(double[] rawWeights) {
        double total = sum(rawWeights);
        if (Math.abs(total) <= EPSILON) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weights sum must not be zero.");
        }
        double[] normalized = new double[rawWeights.length];
        for (int i = 0; i < rawWeights.length; i++) {
            normalized[i] = rawWeights[i] / total;
        }
        return normalized;
    }

    private List<String> normalizeSymbols(List<String> symbols, int n) {
        if (symbols == null || symbols.size() != n) {
            return IntStream.range(0, n)
                    .mapToObj(index -> "Asset-" + (index + 1))
                    .toList();
        }

        List<String> normalized = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            String value = symbols.get(i);
            if (!StringUtils.hasText(value)) {
                normalized.add("Asset-" + (i + 1));
            } else {
                normalized.add(value.trim().toUpperCase(Locale.ROOT));
            }
        }
        return normalized;
    }

    private double[][] toMatrix(List<List<Double>> rows, int n) {
        double[][] matrix = new double[n][n];
        for (int i = 0; i < n; i++) {
            List<Double> row = rows.get(i);
            if (row.size() != n) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correlationMatrix must be square with assetCount columns.");
            }
            for (int j = 0; j < n; j++) {
                matrix[i][j] = row.get(j);
            }
        }
        return matrix;
    }

    private void validateCorrelationMatrix(double[][] matrix) {
        int n = matrix.length;
        for (int i = 0; i < n; i++) {
            if (Math.abs(matrix[i][i] - 1.0) > 1e-6) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correlationMatrix diagonal values must be 1.");
            }
            for (int j = i + 1; j < n; j++) {
                double left = matrix[i][j];
                double right = matrix[j][i];
                if (Math.abs(left - right) > 1e-6) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correlationMatrix must be symmetric.");
                }
                if (left < -1.0 || left > 1.0 || right < -1.0 || right > 1.0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correlationMatrix values must be in [-1, 1].");
                }
            }
        }
    }

    private double[][] choleskyWithJitter(double[][] matrix) {
        int n = matrix.length;
        for (int attempt = 0; attempt < 6; attempt++) {
            double jitter = attempt == 0 ? 0.0 : Math.pow(10, -(10 - attempt));
            double[][] candidate = copyMatrix(matrix);
            if (jitter > 0) {
                for (int i = 0; i < n; i++) {
                    candidate[i][i] += jitter;
                }
            }
            try {
                return cholesky(candidate);
            } catch (IllegalStateException ignored) {
                // Try next jitter level.
            }
        }
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "correlationMatrix is not positive definite; Cholesky decomposition failed."
        );
    }

    private double[][] cholesky(double[][] matrix) {
        int n = matrix.length;
        double[][] lower = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j <= i; j++) {
                double sum = matrix[i][j];
                for (int k = 0; k < j; k++) {
                    sum -= lower[i][k] * lower[j][k];
                }
                if (i == j) {
                    if (sum <= EPSILON) {
                        throw new IllegalStateException("Matrix is not positive definite.");
                    }
                    lower[i][j] = Math.sqrt(sum);
                } else {
                    lower[i][j] = sum / lower[j][j];
                }
            }
        }
        return lower;
    }

    private List<PortfolioPoint> buildMeanPath(List<double[]> paths, int steps, int pathCount, double dt) {
        List<PortfolioPoint> mean = new ArrayList<>(steps + 1);
        for (int step = 0; step <= steps; step++) {
            double sum = 0.0;
            for (double[] path : paths) {
                sum += path[step];
            }
            mean.add(new PortfolioPoint(step, round(step * dt), round(sum / pathCount)));
        }
        return mean;
    }

    private List<PortfolioPath> buildSamplePaths(List<double[]> paths, int steps, double dt) {
        int sampleCount = Math.min(DEFAULT_SAMPLE_PATHS, paths.size());
        List<PortfolioPath> samples = new ArrayList<>(sampleCount);
        for (int idx = 0; idx < sampleCount; idx++) {
            double[] raw = paths.get(idx);
            List<PortfolioPoint> points = new ArrayList<>(steps + 1);
            for (int step = 0; step <= steps; step++) {
                points.add(new PortfolioPoint(step, round(step * dt), round(raw[step])));
            }
            samples.add(new PortfolioPath(idx + 1, points));
        }
        return samples;
    }

    private SimulationStats buildStats(List<double[]> paths, double initialPortfolioValue, int steps, double horizonYears) {
        List<Double> returns = paths.stream()
                .map(path -> path[steps] / initialPortfolioValue - 1.0)
                .sorted(Comparator.naturalOrder())
                .collect(Collectors.toList());

        double expected = mean(returns);
        double std = standardDeviation(returns, expected);
        double annualizedStd = horizonYears > EPSILON ? std / Math.sqrt(horizonYears) : 0.0;
        double q95 = quantile(returns, 0.05);
        double q99 = quantile(returns, 0.01);
        double cvar95 = conditionalTailMean(returns, q95);

        return new SimulationStats(
                round(expected),
                round(annualizedStd),
                round(Math.max(0.0, -q95)),
                round(Math.max(0.0, -q99)),
                round(Math.max(0.0, -cvar95))
        );
    }

    private double conditionalTailMean(List<Double> sortedValues, double threshold) {
        List<Double> tail = sortedValues.stream()
                .filter(value -> value <= threshold)
                .toList();
        if (tail.isEmpty()) {
            return 0.0;
        }
        return mean(tail);
    }

    private double quantile(List<Double> sortedValues, double p) {
        if (sortedValues.isEmpty()) {
            return 0.0;
        }
        int index = (int) Math.floor(p * (sortedValues.size() - 1));
        return sortedValues.get(Math.max(0, Math.min(index, sortedValues.size() - 1)));
    }

    private double standardDeviation(List<Double> values, double mean) {
        if (values.size() < 2) {
            return 0.0;
        }
        double variance = 0.0;
        for (double value : values) {
            double diff = value - mean;
            variance += diff * diff;
        }
        variance /= (values.size() - 1);
        return Math.sqrt(variance);
    }

    private double[] toArray(List<Double> values) {
        double[] array = new double[values.size()];
        for (int i = 0; i < values.size(); i++) {
            array[i] = values.get(i);
        }
        return array;
    }

    private double[] matVec(double[][] matrix, double[] vector) {
        int n = matrix.length;
        double[] out = new double[n];
        for (int i = 0; i < n; i++) {
            double sum = 0.0;
            for (int j = 0; j < n; j++) {
                sum += matrix[i][j] * vector[j];
            }
            out[i] = sum;
        }
        return out;
    }

    private double studentTScale(Random random, int degreesOfFreedom) {
        if (degreesOfFreedom <= 2) {
            throw new IllegalArgumentException("degreesOfFreedom must be greater than 2.");
        }
        double chiSquare = chiSquare(random, degreesOfFreedom);
        return Math.sqrt((degreesOfFreedom - 2.0) / chiSquare);
    }

    private double chiSquare(Random random, int degreesOfFreedom) {
        double sum = 0.0;
        for (int i = 0; i < degreesOfFreedom; i++) {
            double g = random.nextGaussian();
            sum += g * g;
        }
        return sum;
    }

    private double weightedPriceValue(double[] prices, double[] weights) {
        double value = 0.0;
        for (int i = 0; i < prices.length; i++) {
            value += weights[i] * prices[i];
        }
        return value;
    }

    private double[] buildPositionUnits(double[] initialPrices, double[] weights, double initialPortfolioValue) {
        double[] units = new double[weights.length];
        for (int i = 0; i < weights.length; i++) {
            units[i] = (weights[i] * initialPortfolioValue) / initialPrices[i];
        }
        return units;
    }

    private double portfolioValue(double[] prices, double[] positionUnits) {
        double value = 0.0;
        for (int i = 0; i < prices.length; i++) {
            value += positionUnits[i] * prices[i];
        }
        return value;
    }

    private double[][] copyMatrix(double[][] source) {
        int n = source.length;
        double[][] copy = new double[n][n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(source[i], 0, copy[i], 0, n);
        }
        return copy;
    }

    private double sum(double[] values) {
        double total = 0.0;
        for (double value : values) {
            total += value;
        }
        return total;
    }

    private double mean(List<Double> values) {
        if (values.isEmpty()) {
            return 0.0;
        }
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private boolean approximatelyOne(double value, double tolerance) {
        return Math.abs(value - 1.0) <= tolerance;
    }

    private double round(double value) {
        return Math.round(value * 1_000_000d) / 1_000_000d;
    }
}
