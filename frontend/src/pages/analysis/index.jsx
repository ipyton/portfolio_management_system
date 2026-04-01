import React, { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  classForDelta,
  formatDate,
  formatPercent,
  formatSignedPercent,
} from "../../lib/api";

export const analysisPageMeta = {
  eyebrow: "Strategy Analysis",
  title: "Shape a portfolio plan before committing capital.",
  description:
    "Choose your investment intent, get a suggested basket, then run a quick historical backtest.",
  metrics: [],
};

const PROFILE_PRESETS = {
  conservative: {
    label: "Conservative",
    description: "Lower volatility, benchmark-heavy allocation.",
    seeds: ["SPX", "MSFT", "AAPL"],
    weights: [0.5, 0.3, 0.2],
  },
  balanced: {
    label: "Balanced",
    description: "Blend growth and stability with broad diversification.",
    seeds: ["AAPL", "MSFT", "NVDA"],
    weights: [0.34, 0.33, 0.33],
  },
  aggressive: {
    label: "Aggressive",
    description: "Higher beta tilt with concentrated growth exposure.",
    seeds: ["NVDA", "TSLA", "AAPL"],
    weights: [0.45, 0.35, 0.2],
  },
};

const BACKTEST_WINDOWS = [30, 90, 180, 365];
const SIMULATION_STEPS = [90, 126, 252, 365];
const SIMULATION_PATHS = [200, 500, 1000];
const NUM_RANDOM_PORTFOLIOS = 10000;

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function BacktestChart({ points }) {
  if (!points?.length) {
    return (
      <div className="history-empty">
        <strong>No backtest series</strong>
        <p>Add assets and run backtest to render portfolio NAV history.</p>
      </div>
    );
  }

  const width = 560;
  const height = 180;
  const padding = 12;
  const values = points.map((item) => Number(item.nav)).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return (
      <div className="history-empty">
        <strong>No valid values</strong>
        <p>Backtest data returned invalid NAV points.</p>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const path = points
    .map((item, index) => {
      const x = padding + index * stepX;
      const y = padding + ((max - Number(item.nav)) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const totalReturn = Number(points[points.length - 1].nav) - Number(points[0].nav);

  return (
    <div className="history-chart">
      <div className="history-meta">
        <span>Portfolio NAV</span>
        <strong className={classForDelta(totalReturn)}>
          {formatSignedPercent(totalReturn)}
        </strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Backtest NAV chart">
        <path d={path} className="history-line" />
      </svg>
    </div>
  );
}

function SimulationChart({ meanPath, samplePaths }) {
  if (!meanPath?.length) {
    return (
      <div className="history-empty">
        <strong>No simulation path</strong>
        <p>Run Wiener simulation to render projected portfolio paths.</p>
      </div>
    );
  }

  const width = 560;
  const height = 180;
  const padding = 12;
  const allSeries = [...(samplePaths || []).map((item) => item.points || []), meanPath];
  const values = allSeries
    .flatMap((series) => series.map((point) => Number(point.value)))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return (
      <div className="history-empty">
        <strong>No valid simulation values</strong>
        <p>Projected path contains invalid points.</p>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = meanPath.length > 1 ? (width - padding * 2) / (meanPath.length - 1) : 0;

  const linePath = (series) =>
    series
      .map((point, index) => {
        const x = padding + index * stepX;
        const y = padding + ((max - Number(point.value)) / range) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  return (
    <div className="history-chart simulation-chart">
      <div className="history-meta">
        <span>Monte Carlo Projection</span>
        <strong>
          Mean terminal: {formatSignedPercent(Number(meanPath[meanPath.length - 1]?.value) / Number(meanPath[0]?.value) - 1)}
        </strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monte Carlo portfolio path chart">
        {(samplePaths || []).slice(0, 6).map((path) => (
          <path key={path.pathIndex} d={linePath(path.points || [])} className="simulation-line" />
        ))}
        <path d={linePath(meanPath)} className="history-line simulation-mean-line" />
      </svg>
    </div>
  );
}

function EfficientFrontierChart({ points, optimal }) {
  if (!points?.length) {
    return (
      <div className="history-empty">
        <strong>No efficient frontier</strong>
        <p>Run Sharpe optimization to generate random portfolio cloud.</p>
      </div>
    );
  }

  const width = 560;
  const height = 220;
  const padding = 18;
  const vols = points.map((point) => point.volatility).filter((value) => Number.isFinite(value));
  const rets = points.map((point) => point.expectedReturn).filter((value) => Number.isFinite(value));
  if (!vols.length || !rets.length) {
    return (
      <div className="history-empty">
        <strong>No valid frontier points</strong>
        <p>Generated portfolios contain invalid volatility/return values.</p>
      </div>
    );
  }

  const minVol = Math.min(...vols);
  const maxVol = Math.max(...vols);
  const minRet = Math.min(...rets);
  const maxRet = Math.max(...rets);
  const volRange = maxVol - minVol || 1;
  const retRange = maxRet - minRet || 1;

  const mapX = (vol) => padding + ((vol - minVol) / volRange) * (width - padding * 2);
  const mapY = (ret) => height - padding - ((ret - minRet) / retRange) * (height - padding * 2);

  const chartPoints = points.slice(0, 3500);

  return (
    <div className="frontier-chart">
      <div className="history-meta">
        <span>Efficient Frontier</span>
        <strong>Max Sharpe: {optimal ? optimal.sharpeRatio.toFixed(3) : "N/A"}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sharpe frontier scatter chart">
        {chartPoints.map((point, index) => (
          <circle
            key={`${index}-${point.volatility}`}
            cx={mapX(point.volatility)}
            cy={mapY(point.expectedReturn)}
            r="2"
            className="frontier-dot"
          />
        ))}
        {optimal ? (
          <circle
            cx={mapX(optimal.volatility)}
            cy={mapY(optimal.expectedReturn)}
            r="6"
            className="frontier-optimal-dot"
          />
        ) : null}
      </svg>
    </div>
  );
}

function OptimalWeightsChart({ weights }) {
  if (!weights?.length) {
    return null;
  }

  const width = 560;
  const height = 220;
  const padding = 18;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const barGap = 10;
  const barWidth = Math.max(12, (innerWidth - barGap * (weights.length - 1)) / weights.length);
  const maxWeight = Math.max(...weights.map((item) => Number(item.weight) || 0), 1);

  return (
    <div className="weights-chart">
      <div className="history-meta">
        <span>Optimal Weights</span>
        <strong>Allocation by Asset</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Optimal portfolio weights bar chart">
        {weights.map((item, index) => {
          const weight = Number(item.weight) || 0;
          const x = padding + index * (barWidth + barGap);
          const h = Math.max(0, (weight / maxWeight) * (innerHeight - 28));
          const y = height - padding - h - 20;
          return (
            <g key={item.symbol}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                className="weights-bar"
                rx="4"
              />
              <text x={x + barWidth / 2} y={height - padding - 6} textAnchor="middle" className="weights-ticker">
                {item.symbol}
              </text>
              <text x={x + barWidth / 2} y={Math.max(y - 4, 12)} textAnchor="middle" className="weights-value">
                {(weight * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function computeMaxDrawdown(points) {
  if (!points.length) {
    return null;
  }

  let peak = Number(points[0].nav);
  let maxDrawdown = 0;
  points.forEach((point) => {
    const nav = Number(point.nav);
    if (nav > peak) {
      peak = nav;
    }
    const drawdown = peak === 0 ? 0 : nav / peak - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });
  return maxDrawdown;
}

function buildPortfolioCurve(histories, basket) {
  const bySymbol = new Map(
    histories
      .filter((item) => item.items?.length)
      .map((item) => [item.symbol, item.items]),
  );

  const symbolSet = basket
    .map((item) => item.symbol)
    .filter((symbol) => bySymbol.has(symbol));

  if (!symbolSet.length) {
    return [];
  }

  const dateIntersection = symbolSet
    .map((symbol) => new Set(bySymbol.get(symbol).map((point) => point.tradeDate)))
    .reduce((acc, set) => new Set([...acc].filter((date) => set.has(date))));

  const dates = [...dateIntersection].sort();
  if (!dates.length) {
    return [];
  }

  const weighted = symbolSet.map((symbol) => {
    const series = bySymbol.get(symbol);
    const first = Number(series[0]?.close);
    const weight = basket.find((item) => item.symbol === symbol)?.weight || 0;
    const byDate = new Map(series.map((point) => [point.tradeDate, Number(point.close)]));
    return { symbol, first, weight, byDate };
  });

  return dates.map((date) => {
    const nav = weighted.reduce((sum, item) => {
      const close = item.byDate.get(date);
      if (!Number.isFinite(close) || !Number.isFinite(item.first) || item.first === 0) {
        return sum;
      }
      return sum + item.weight * (close / item.first);
    }, 0);
    return { date, nav };
  });
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStd(values) {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function buildCorrelationMatrix(returnSeriesList) {
  const n = returnSeriesList.length;
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  const stds = returnSeriesList.map((series) => sampleStd(series));
  const means = returnSeriesList.map((series) => mean(series));

  for (let i = 0; i < n; i += 1) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      let cov = 0;
      for (let k = 0; k < returnSeriesList[i].length; k += 1) {
        cov +=
          (returnSeriesList[i][k] - means[i]) *
          (returnSeriesList[j][k] - means[j]);
      }
      cov = returnSeriesList[i].length > 1 ? cov / (returnSeriesList[i].length - 1) : 0;
      const denom = stds[i] * stds[j];
      const corr = denom > 0 ? Math.max(-0.999, Math.min(0.999, cov / denom)) : 0;
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return matrix;
}

function formatLossPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return `-${(Number(value) * 100).toFixed(2)}%`;
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function matrixVector(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function covarianceMatrix(seriesList) {
  const n = seriesList.length;
  const length = seriesList[0]?.length || 0;
  const means = seriesList.map((series) => mean(series));
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      let cov = 0;
      for (let k = 0; k < length; k += 1) {
        cov += (seriesList[i][k] - means[i]) * (seriesList[j][k] - means[j]);
      }
      cov = length > 1 ? cov / (length - 1) : 0;
      matrix[i][j] = cov;
      matrix[j][i] = cov;
    }
  }

  return matrix;
}

export default function AnalysisPage({ meta }) {
  const [profile, setProfile] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [basket, setBasket] = useState([]);
  const [windowDays, setWindowDays] = useState(90);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const [backtestResult, setBacktestResult] = useState(null);
  const [simulationSteps, setSimulationSteps] = useState(252);
  const [simulationPaths, setSimulationPaths] = useState(500);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);
  const [sharpeLoading, setSharpeLoading] = useState(false);
  const [sharpeError, setSharpeError] = useState("");
  const [sharpeResult, setSharpeResult] = useState(null);

  const profilePreset = profile ? PROFILE_PRESETS[profile] : null;

  useEffect(() => {
    let cancelled = false;
    const keyword = query.trim();
    if (!keyword || !profile) {
      setSuggestions([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiFetch(
          `/api/assets/suggestions?query=${encodeURIComponent(keyword)}&limit=6`,
        );
        if (!cancelled) {
          setSuggestions(response.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, profile]);

  const normalizedBasket = useMemo(() => {
    if (!basket.length) {
      return [];
    }
    const totalWeight = basket.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      const equalWeight = 1 / basket.length;
      return basket.map((item) => ({ ...item, weight: equalWeight }));
    }
    return basket.map((item) => ({ ...item, weight: Number(item.weight || 0) / totalWeight }));
  }, [basket]);

  async function generateRecommendations() {
    if (!profilePreset) {
      return;
    }
    setRecommendationLoading(true);
    setBacktestError("");
    try {
      const responseList = await Promise.all(
        profilePreset.seeds.map((seed) =>
          apiFetch(`/api/assets/suggestions?query=${encodeURIComponent(seed)}&limit=4`),
        ),
      );

      const merged = [];
      const seen = new Set();
      responseList.forEach((response) => {
        (response.items || []).forEach((item) => {
          const key = (item.symbol || "").toUpperCase();
          if (!key || seen.has(key)) {
            return;
          }
          seen.add(key);
          merged.push(item);
        });
      });

      const picked = merged.slice(0, 5).map((item, index) => ({
        ...item,
        targetWeight: profilePreset.weights[index] ?? Math.max(0.1, 1 / Math.max(1, merged.length)),
      }));

      setRecommendations(picked);
      if (!normalizedBasket.length && picked.length) {
        const initial = picked.slice(0, 3).map((item) => ({
          symbol: item.symbol,
          name: item.name,
          weight: item.targetWeight,
        }));
        setBasket(initial);
      }
    } catch (error) {
      setRecommendations([]);
      setBacktestError(error.message);
    } finally {
      setRecommendationLoading(false);
    }
  }

  function addToBasket(item) {
    const symbol = (item.symbol || "").toUpperCase();
    if (!symbol) {
      return;
    }
    setBasket((current) => {
      if (current.some((asset) => asset.symbol === symbol)) {
        return current;
      }
      return [...current, { symbol, name: item.name, weight: 1 / Math.max(1, current.length + 1) }];
    });
  }

  function removeFromBasket(symbol) {
    setBasket((current) => current.filter((item) => item.symbol !== symbol));
  }

  async function loadAlignedSeries(historyDays) {
    const historyList = await Promise.all(
      normalizedBasket.map(async (item) => {
        const response = await apiFetch(
          `/api/assets/price-history?query=${encodeURIComponent(item.symbol)}&days=${historyDays}`,
        );
        const items = (response.items || [])
          .map((point) => ({
            tradeDate: point.tradeDate,
            close: Number(point.close),
          }))
          .filter((point) => point.tradeDate && Number.isFinite(point.close) && point.close > 0)
          .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
        return { symbol: item.symbol, name: item.name, items };
      }),
    );

    const available = historyList.filter((item) => item.items.length >= 30);
    if (!available.length) {
      throw new Error("Not enough history to run analysis.");
    }

    const dateIntersection = available
      .map((item) => new Set(item.items.map((point) => point.tradeDate)))
      .reduce((acc, set) => new Set([...acc].filter((date) => set.has(date))));

    const commonDates = [...dateIntersection].sort();
    if (commonDates.length < 30) {
      throw new Error("Common history window is too short across selected assets.");
    }

    const usableDates = commonDates.slice(-Math.min(commonDates.length, historyDays));
    const seriesBySymbol = available
      .map((asset) => {
        const byDate = new Map(asset.items.map((point) => [point.tradeDate, point.close]));
        const closes = usableDates
          .map((date) => byDate.get(date))
          .filter((value) => Number.isFinite(value) && value > 0);
        return {
          symbol: asset.symbol,
          name: asset.name,
          closes,
        };
      })
      .filter((item) => item.closes.length >= 30);

    if (!seriesBySymbol.length) {
      throw new Error("No valid close series available for analysis.");
    }

    const alignedLength = Math.min(...seriesBySymbol.map((item) => item.closes.length));
    const alignedSeries = seriesBySymbol.map((item) => ({
      ...item,
      closes: item.closes.slice(-alignedLength),
    }));

    return alignedSeries;
  }

  async function runBacktest() {
    if (!profile || !normalizedBasket.length) {
      return;
    }
    setBacktestLoading(true);
    setBacktestError("");
    try {
      const historyList = await Promise.all(
        normalizedBasket.map(async (item) => {
          const response = await apiFetch(
            `/api/assets/price-history?query=${encodeURIComponent(item.symbol)}&days=${windowDays}`,
          );
          return { symbol: item.symbol, items: response.items || [] };
        }),
      );

      const curve = buildPortfolioCurve(historyList, normalizedBasket);
      if (!curve.length) {
        throw new Error("No overlapping history returned for the selected basket.");
      }

      const totalReturn = Number(curve[curve.length - 1].nav) / Number(curve[0].nav) - 1;
      const annualizedReturn =
        curve.length > 1 ? (1 + totalReturn) ** (365 / (curve.length - 1)) - 1 : totalReturn;
      const maxDrawdown = computeMaxDrawdown(curve);

      const assetReturns = historyList
        .map((item) => {
          const first = Number(item.items[0]?.close);
          const last = Number(item.items[item.items.length - 1]?.close);
          if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
            return null;
          }
          return {
            symbol: item.symbol,
            totalReturn: last / first - 1,
          };
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.totalReturn) - Number(a.totalReturn));

      setBacktestResult({
        curve,
        totalReturn,
        annualizedReturn,
        maxDrawdown,
        assetReturns,
      });
    } catch (error) {
      setBacktestResult(null);
      setBacktestError(error.message);
    } finally {
      setBacktestLoading(false);
    }
  }

  async function runWienerSimulation() {
    if (!profile || !normalizedBasket.length) {
      return;
    }

    setSimulationLoading(true);
    setSimulationError("");
    try {
      const historyDays = Math.max(252, simulationSteps + 30);
      const alignedSeries = await loadAlignedSeries(historyDays);

      const returnSeriesList = alignedSeries.map((item) => {
        const returns = [];
        for (let i = 1; i < item.closes.length; i += 1) {
          const prev = item.closes[i - 1];
          const curr = item.closes[i];
          returns.push(curr / prev - 1);
        }
        return returns;
      });

      const annualReturns = returnSeriesList.map((series) => mean(series) * 252);
      const annualVolatilities = returnSeriesList.map((series) =>
        Math.max(sampleStd(series) * Math.sqrt(252), 0.0001),
      );
      const initialPrices = alignedSeries.map((item) => item.closes[item.closes.length - 1]);
      const symbols = alignedSeries.map((item) => item.symbol);
      const weightBySymbol = new Map(normalizedBasket.map((item) => [item.symbol, item.weight]));
      const weights = symbols.map((symbol) => Number(weightBySymbol.get(symbol) || 0));
      const correlationMatrix = buildCorrelationMatrix(returnSeriesList);

      const response = await apiFetch("/api/portfolio/analysis/wiener-simulation", {
        method: "POST",
        body: {
          assetCount: symbols.length,
          symbols,
          initialPrices,
          annualReturns,
          annualVolatilities,
          weights,
          correlationMatrix,
          steps: simulationSteps,
          paths: simulationPaths,
        },
      });

      setSimulationResult(response);
    } catch (error) {
      setSimulationResult(null);
      setSimulationError(error.message);
    } finally {
      setSimulationLoading(false);
    }
  }

  async function runSharpeOptimization() {
    if (!profile || !normalizedBasket.length) {
      return;
    }

    setSharpeLoading(true);
    setSharpeError("");
    try {
      const alignedSeries = await loadAlignedSeries(Math.max(252, windowDays + 30));
      const symbols = alignedSeries.map((item) => item.symbol);

      const logReturnSeries = alignedSeries.map((item) => {
        const returns = [];
        for (let i = 1; i < item.closes.length; i += 1) {
          const prev = item.closes[i - 1];
          const curr = item.closes[i];
          returns.push(Math.log(curr / prev));
        }
        return returns;
      });

      const annualReturns = logReturnSeries.map((series) => mean(series) * 252);
      const covDaily = covarianceMatrix(logReturnSeries);
      const covAnnual = covDaily.map((row) => row.map((value) => value * 252));

      const points = [];
      let best = null;
      for (let i = 0; i < NUM_RANDOM_PORTFOLIOS; i += 1) {
        const raw = symbols.map(() => Math.random());
        const sumRaw = raw.reduce((sum, value) => sum + value, 0);
        const weights = raw.map((value) => value / sumRaw);

        const expectedReturn = dot(annualReturns, weights);
        const variance = Math.max(0, dot(weights, matrixVector(covAnnual, weights)));
        const volatility = Math.sqrt(variance);
        if (!Number.isFinite(volatility) || volatility <= 0) {
          continue;
        }
        const sharpeRatio = expectedReturn / volatility;
        const point = { expectedReturn, volatility, sharpeRatio, weights };
        points.push(point);

        if (!best || sharpeRatio > best.sharpeRatio) {
          best = point;
        }
      }

      if (!best || !points.length) {
        throw new Error("Failed to generate valid random portfolios for Sharpe optimization.");
      }

      const optimalWeights = symbols.map((symbol, index) => ({
        symbol,
        weight: best.weights[index],
      }));

      setSharpeResult({
        points,
        optimal: {
          expectedReturn: best.expectedReturn,
          volatility: best.volatility,
          sharpeRatio: best.sharpeRatio,
          weights: optimalWeights,
        },
      });
    } catch (error) {
      setSharpeResult(null);
      setSharpeError(error.message);
    } finally {
      setSharpeLoading(false);
    }
  }

  return (
    <>
      <section className="hero-panel">
        <p className="eyebrow">{meta.eyebrow}</p>
        <div className="hero-heading-row">
          <div>
            <h1>{meta.title}</h1>
            <p className="hero-copy">{meta.description}</p>
          </div>
          <div className="hero-status-card">
            <span>Analysis State</span>
            <strong>{profile ? "Profile selected" : "Select profile"}</strong>
            <p>
              {profile
                ? `${PROFILE_PRESETS[profile].label}: ${PROFILE_PRESETS[profile].description}`
                : "Pick investment intent first, then generate recommendations and run backtest."}
            </p>
          </div>
        </div>

        <div className="hero-metrics">
          <article className="hero-metric">
            <span>Profile</span>
            <strong>{profile ? PROFILE_PRESETS[profile].label : "Not selected"}</strong>
            <p>Required before recommendation/backtest.</p>
          </article>
          <article className="hero-metric">
            <span>Basket Size</span>
            <strong>{basket.length}</strong>
            <p>Assets currently included in backtest basket.</p>
          </article>
          <article className="hero-metric">
            <span>Backtest Window</span>
            <strong>{windowDays} days</strong>
            <p>Daily close from existing `/api/assets/price-history` API.</p>
          </article>
        </div>
      </section>

      <section className="watchlist-shell watchlist-component analysis-shell">
        <div className="watchlist-header">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="watchlist-title">Choose investment intent</h2>
          </div>
          <div className="analysis-actions">
            <button
              type="button"
              className="search-button"
              disabled={!profile || recommendationLoading}
              onClick={generateRecommendations}
            >
              {recommendationLoading ? "Generating..." : "Generate Recommendations"}
            </button>
          </div>
        </div>

        <div className="analysis-profile-grid">
          {Object.entries(PROFILE_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              className={`analysis-profile-card${profile === id ? " active" : ""}`}
              onClick={() => setProfile(id)}
            >
              <strong>{preset.label}</strong>
              <p>{preset.description}</p>
            </button>
          ))}
        </div>

        <div className="watchlist-grid">
          <section className="watchlist-panel">
            <div className="card-head">
              <span>Recommendations</span>
              <strong>{recommendations.length}</strong>
            </div>
            {!profile ? (
              <EmptyState
                title="Select profile first"
                description="Recommendation engine unlocks after investment intent is selected."
              />
            ) : !recommendations.length ? (
              <EmptyState
                title="No recommendations yet"
                description="Click Generate Recommendations to build a candidate basket."
              />
            ) : (
              <div className="watchlist-table">
                {recommendations.map((item) => (
                  <button
                    key={`${item.symbol}-${item.assetId ?? "remote"}`}
                    type="button"
                    className="watchlist-row"
                    onClick={() => addToBasket(item)}
                  >
                    <div>
                      <strong className="ticker">{item.symbol}</strong>
                      <p>{item.name}</p>
                    </div>
                    <div>
                      <strong>{Math.round((item.targetWeight || 0) * 100)}%</strong>
                      <p>Target Weight</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="search-results">
              <div className="card-head">
                <span>Search & Add</span>
                <strong>{searching ? "..." : suggestions.length}</strong>
              </div>
              <label className="watchlist-search">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={profile ? "Search symbol to add to basket" : "Select profile first"}
                  disabled={!profile}
                />
              </label>
              {!profile ? (
                <EmptyState
                  title="Profile required"
                  description="Select Conservative, Balanced, or Aggressive first."
                />
              ) : !query.trim() ? (
                <EmptyState
                  title="Type to search"
                  description="Suggestions are powered by `/api/assets/suggestions`."
                />
              ) : (
                suggestions.map((item) => (
                  <button
                    key={`${item.symbol}-suggest`}
                    type="button"
                    className="search-result"
                    onClick={() => addToBasket(item)}
                  >
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="watchlist-panel detail-panel">
            <div className="card-head">
              <span>Backtest Basket</span>
              <strong>{normalizedBasket.length} assets</strong>
            </div>

            {!normalizedBasket.length ? (
              <EmptyState
                title="Basket is empty"
                description="Add symbols from recommendations or search results."
              />
            ) : (
              <div className="analysis-basket-list">
                {normalizedBasket.map((item) => (
                  <div key={item.symbol} className="analysis-basket-item">
                    <div>
                      <strong>{item.symbol}</strong>
                      <p>{item.name || "Unnamed asset"}</p>
                    </div>
                    <div className="analysis-basket-meta">
                      <span>{Math.round(item.weight * 100)}%</span>
                      <button
                        type="button"
                        className="analysis-remove"
                        onClick={() => removeFromBasket(item.symbol)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="analysis-controls">
              <label>
                Backtest Window
                <select
                  value={windowDays}
                  onChange={(event) => setWindowDays(Number(event.target.value))}
                  disabled={!normalizedBasket.length || !profile}
                >
                  {BACKTEST_WINDOWS.map((days) => (
                    <option key={days} value={days}>
                      {days} days
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="search-button"
                onClick={runBacktest}
                disabled={!profile || !normalizedBasket.length || backtestLoading}
              >
                {backtestLoading ? "Running..." : "Run Backtest"}
              </button>
            </div>

            {backtestError ? <p className="inline-error">{backtestError}</p> : null}

            {backtestResult ? (
              <>
                <div className="stats-grid live-stats">
                  <div>
                    <span>Total Return</span>
                    <strong className={classForDelta(backtestResult.totalReturn)}>
                      {formatSignedPercent(backtestResult.totalReturn)}
                    </strong>
                  </div>
                  <div>
                    <span>Annualized Return</span>
                    <strong className={classForDelta(backtestResult.annualizedReturn)}>
                      {formatSignedPercent(backtestResult.annualizedReturn)}
                    </strong>
                  </div>
                  <div>
                    <span>Max Drawdown</span>
                    <strong className={classForDelta(backtestResult.maxDrawdown)}>
                      {formatSignedPercent(backtestResult.maxDrawdown)}
                    </strong>
                  </div>
                  <div>
                    <span>Last Date</span>
                    <strong>{formatDate(backtestResult.curve[backtestResult.curve.length - 1]?.date)}</strong>
                  </div>
                </div>

                <BacktestChart points={backtestResult.curve} />

                <div className="activity-list">
                  {(backtestResult.assetReturns || []).slice(0, 5).map((item) => (
                    <div key={item.symbol} className="activity-item">
                      <span className="activity-dot" />
                      <p>
                        {item.symbol}: {formatSignedPercent(item.totalReturn)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="Backtest not run"
                description="After selecting profile and basket, click Run Backtest."
              />
            )}

            <div className="analysis-simulation">
              <div className="card-head">
                <span>Wiener Simulation</span>
                <strong>{simulationResult ? `${simulationResult.paths} paths` : "Not run"}</strong>
              </div>

              <div className="analysis-controls">
                <label>
                  Simulation Steps
                  <select
                    value={simulationSteps}
                    onChange={(event) => setSimulationSteps(Number(event.target.value))}
                    disabled={!profile || !normalizedBasket.length || simulationLoading}
                  >
                    {SIMULATION_STEPS.map((steps) => (
                      <option key={steps} value={steps}>
                        {steps} steps
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Monte Carlo Paths
                  <select
                    value={simulationPaths}
                    onChange={(event) => setSimulationPaths(Number(event.target.value))}
                    disabled={!profile || !normalizedBasket.length || simulationLoading}
                  >
                    {SIMULATION_PATHS.map((paths) => (
                      <option key={paths} value={paths}>
                        {paths} paths
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="search-button"
                  onClick={runWienerSimulation}
                  disabled={!profile || !normalizedBasket.length || simulationLoading}
                >
                  {simulationLoading ? "Simulating..." : "Run Wiener Simulation"}
                </button>
              </div>

              {simulationError ? <p className="inline-error">{simulationError}</p> : null}

              {simulationResult ? (
                <>
                  <div className="stats-grid live-stats">
                    <div>
                      <span>Expected Return</span>
                      <strong className={classForDelta(simulationResult.stats?.expectedReturn)}>
                        {formatSignedPercent(simulationResult.stats?.expectedReturn)}
                      </strong>
                    </div>
                    <div>
                      <span>Annualized Volatility</span>
                      <strong>{formatPercent(simulationResult.stats?.annualizedVolatility)}</strong>
                    </div>
                    <div>
                      <span>VaR 95</span>
                      <strong className="negative">{formatLossPercent(simulationResult.stats?.var95)}</strong>
                    </div>
                    <div>
                      <span>CVaR 95</span>
                      <strong className="negative">{formatLossPercent(simulationResult.stats?.cvar95)}</strong>
                    </div>
                  </div>

                  <SimulationChart
                    meanPath={simulationResult.meanPath || []}
                    samplePaths={simulationResult.samplePaths || []}
                  />

                  {simulationResult.warnings?.length ? (
                    <div className="activity-list">
                      {simulationResult.warnings.map((warning) => (
                        <div key={warning} className="activity-item">
                          <span className="activity-dot" />
                          <p>{warning}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="Simulation not run"
                  description="Run Wiener simulation to project correlated portfolio paths."
                />
              )}
            </div>

            <div className="analysis-simulation">
              <div className="card-head">
                <span>Sharpe Optimization</span>
                <strong>{sharpeResult ? `${NUM_RANDOM_PORTFOLIOS} portfolios` : "Not run"}</strong>
              </div>

              <div className="analysis-actions">
                <button
                  type="button"
                  className="search-button"
                  onClick={runSharpeOptimization}
                  disabled={!profile || !normalizedBasket.length || sharpeLoading}
                >
                  {sharpeLoading ? "Optimizing..." : "Run Sharpe Optimization"}
                </button>
              </div>

              {sharpeError ? <p className="inline-error">{sharpeError}</p> : null}

              {sharpeResult ? (
                <>
                  <div className="stats-grid live-stats">
                    <div>
                      <span>Expected Return</span>
                      <strong className={classForDelta(sharpeResult.optimal.expectedReturn)}>
                        {formatSignedPercent(sharpeResult.optimal.expectedReturn)}
                      </strong>
                    </div>
                    <div>
                      <span>Volatility</span>
                      <strong>{formatPercent(sharpeResult.optimal.volatility)}</strong>
                    </div>
                    <div>
                      <span>Sharpe Ratio</span>
                      <strong>{Number(sharpeResult.optimal.sharpeRatio).toFixed(3)}</strong>
                    </div>
                    <div>
                      <span>Portfolios</span>
                      <strong>{sharpeResult.points.length}</strong>
                    </div>
                  </div>

                  <EfficientFrontierChart
                    points={sharpeResult.points}
                    optimal={sharpeResult.optimal}
                  />

                  <OptimalWeightsChart weights={sharpeResult.optimal.weights} />

                  <div className="analysis-optimal-weights">
                    {sharpeResult.optimal.weights.map((item) => (
                      <div key={item.symbol} className="analysis-optimal-item">
                        <strong>{item.symbol}</strong>
                        <span>{(item.weight * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Sharpe optimization not run"
                  description="Generate random portfolios and locate the highest Sharpe-ratio allocation."
                />
              )}
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
