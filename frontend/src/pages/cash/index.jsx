import React, { useCallback, useEffect, useMemo, useState } from "react";
import LoadingInline from "../../components/LoadingInline";
import {
  buildFxRateMap,
  convertAmountByFx,
  DEFAULT_USER_ID,
  fetchFxLatest,
  fetchCashBalances,
  fetchCashTransactions,
  formatCurrency,
  mockCashDeposit,
  mockCashWithdraw,
} from "../../lib/api";
import "./cash.css";

export const cashPageMeta = {
  eyebrow: "Cash Account",
  title: "Manage mock deposit and withdraw quickly.",
  description: "Simulate top-ups and withdrawals, then inspect account balances and ledger history.",
  metrics: [],
};

const DEFAULT_CURRENCIES = ["USD", "CNY", "HKD", "EUR", "JPY"];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateTime(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function generateBizId(actionType) {
  const action = actionType === "withdraw" ? "withdraw" : "deposit";
  const seed = Math.random().toString(36).slice(2, 8);
  return `cash-${action}-${Date.now()}-${seed}`;
}

function normalizeCurrency(value) {
  return String(value || "").trim().toUpperCase();
}

export default function CashPage({ userId = DEFAULT_USER_ID }) {
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fxRateMap, setFxRateMap] = useState({ USD: 1 });

  const [actionType, setActionType] = useState("deposit");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");

  const knownCurrencies = useMemo(() => {
    const dynamicCurrencies = [
      ...balances.map((item) => normalizeCurrency(item?.currency)),
      ...transactions.map((item) => normalizeCurrency(item?.currency)),
    ].filter(Boolean);
    return [...new Set([...DEFAULT_CURRENCIES, ...dynamicCurrencies])];
  }, [balances, transactions]);

  const formatUsdValue = useCallback(
    (value, sourceCurrency) => {
      const converted = convertAmountByFx(value, sourceCurrency, fxRateMap, "USD");
      return converted === null ? "N/A" : formatCurrency(converted, "USD");
    },
    [fxRateMap],
  );

  const refreshData = useCallback(
    async (nextFilter) => {
      setLoading(true);
      setError("");
      try {
        const [balanceResponse, transactionResponse, fxResponse] = await Promise.all([
          fetchCashBalances(userId),
          fetchCashTransactions({
            userId,
            currency: nextFilter === "ALL" ? undefined : nextFilter,
          }),
          fetchFxLatest("USD").catch(() => null),
        ]);

        setBalances(Array.isArray(balanceResponse?.items) ? balanceResponse.items : []);
        setTransactions(Array.isArray(transactionResponse?.items) ? transactionResponse.items : []);
        if (fxResponse) {
          setFxRateMap(buildFxRateMap(fxResponse, "USD"));
        }
        setLastUpdated(new Date().toISOString());
      } catch (requestError) {
        setError(requestError?.message || "Failed to load cash account data.");
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    refreshData(currencyFilter);
  }, [currencyFilter, refreshData]);

  useEffect(() => {
    if (!knownCurrencies.includes(formCurrency)) {
      setFormCurrency(knownCurrencies[0] || "USD");
    }
  }, [formCurrency, knownCurrencies]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedCurrency = normalizeCurrency(formCurrency);
    const numericAmount = toNumber(amount, NaN);

    if (!normalizedCurrency) {
      setError("Currency is required.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    const payload = {
      userId,
      currency: normalizedCurrency,
      amount: numericAmount,
      bizId: generateBizId(actionType),
      note: note.trim() || null,
    };

    setSubmitting(true);
    try {
      const response =
        actionType === "withdraw"
          ? await mockCashWithdraw(payload)
          : await mockCashDeposit(payload);

      const verb = actionType === "withdraw" ? "Withdraw" : "Deposit";
      const sourceCurrency = response?.currency || normalizedCurrency;
      setSuccess(
        `${verb} success: ${formatUsdValue(response?.amount, sourceCurrency)}. `
        + `Available ${formatUsdValue(response?.availableBalanceBefore, sourceCurrency)} -> ${formatUsdValue(response?.availableBalanceAfter, sourceCurrency)}.`,
      );

      setAmount("");
      setNote("");
      await refreshData(currencyFilter);
    } catch (requestError) {
      setError(requestError?.message || "Transfer request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cash-page">
      <section className="hero-panel cash-hero-panel">
        <p className="eyebrow">Cash Simulation</p>
        <div className="cash-hero-headline-row">
          <h1>Mock Deposit / Withdraw</h1>
          <button
            type="button"
            className="cash-refresh-btn"
            onClick={() => refreshData(currencyFilter)}
            disabled={loading || submitting}
          >
            {loading ? <LoadingInline label="Refreshing..." size="xs" /> : "Refresh"}
          </button>
        </div>
        <p className="hero-copy cash-hero-copy">
          Use backend mock transfer APIs to top up or withdraw cash by currency.
        </p>
        <div className="cash-status-row">
          <span className={`cash-status-pill${loading ? " loading" : ""}`}>
            {loading ? <LoadingInline label="Syncing data" size="xs" /> : "Data synced"}
          </span>
          <span className="cash-status-time">
            Last updated: {lastUpdated ? formatDateTime(lastUpdated) : "N/A"}
          </span>
        </div>
      </section>

      {(error || success) && (
        <section className="feature-card cash-message-card" aria-live="polite">
          {error ? <p className="cash-message error">{error}</p> : null}
          {success ? <p className="cash-message success">{success}</p> : null}
        </section>
      )}

      <div className="cash-grid">
        <div className="cash-left-col">
          <section className="feature-card cash-transfer-card">
            <h2>Transfer</h2>
            <form className="cash-transfer-form" onSubmit={handleSubmit}>
              <label htmlFor="cash-action-type">Action</label>
              <select
                id="cash-action-type"
                value={actionType}
                onChange={(event) => setActionType(event.target.value)}
                disabled={submitting}
              >
                <option value="deposit">Deposit</option>
                <option value="withdraw">Withdraw</option>
              </select>

              <label htmlFor="cash-currency">Currency</label>
              <select
                id="cash-currency"
                value={formCurrency}
                onChange={(event) => setFormCurrency(event.target.value)}
                disabled={submitting}
              >
                {knownCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>

              <label htmlFor="cash-amount">Amount</label>
              <input
                id="cash-amount"
                type="number"
                inputMode="decimal"
                min="0.000001"
                step="0.000001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="1000"
                disabled={submitting}
              />

              <label htmlFor="cash-note">Note</label>
              <textarea
                id="cash-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional memo"
                rows={3}
                maxLength={255}
                disabled={submitting}
              />

              <button type="submit" disabled={submitting || loading}>
                {submitting
                  ? <LoadingInline label="Submitting..." size="xs" tone="inverted" />
                  : actionType === "withdraw"
                    ? "Submit Withdraw"
                    : "Submit Deposit"}
              </button>
            </form>
          </section>

          <section className="feature-card cash-balance-card">
            <h2>Balances</h2>
            {balances.length ? (
              <div className="cash-balance-list">
                {balances.map((item) => (
                  <article key={`${item.cashAccountId || item.currency}-${item.currency}`} className="cash-balance-item">
                    <header>
                      <strong>USD View</strong>
                      <span>{item.currency || "N/A"} · ID {item.cashAccountId || "-"}</span>
                    </header>
                    <p>Available: {formatUsdValue(item.availableBalance, item.currency)}</p>
                    <p>Total: {formatUsdValue(item.balance, item.currency)}</p>
                    <p>Frozen: {formatUsdValue(item.frozenBalance, item.currency)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="cash-empty">
                {loading
                  ? <LoadingInline label="Loading balances..." size="xs" tone="muted" />
                  : "No cash account balance yet."}
              </p>
            )}
          </section>
        </div>

        <section className="feature-card cash-history-card">
          <div className="cash-history-head">
            <h2>Transactions</h2>
            <label htmlFor="cash-filter-currency">
              Currency
              <select
                id="cash-filter-currency"
                value={currencyFilter}
                onChange={(event) => setCurrencyFilter(event.target.value)}
                disabled={loading || submitting}
              >
                <option value="ALL">ALL</option>
                {knownCurrencies.map((currency) => (
                  <option key={`filter-${currency}`} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="cash-table-wrap">
            <table className="cash-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Source Currency</th>
                  <th>Amount (USD)</th>
                  <th>Available After (USD)</th>
                  <th>Status</th>
                  <th>BizId</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length ? (
                  transactions.map((item) => {
                    const isWithdraw = String(item?.txType || "").toUpperCase() === "WITHDRAW";
                    return (
                      <tr key={item.transactionId || item.bizId || `${item.occurredAt}-${item.currency}`}>
                        <td>{formatDateTime(item.occurredAt)}</td>
                        <td>
                          <span className={`cash-type-pill ${isWithdraw ? "withdraw" : "deposit"}`}>
                            {item.txType || "N/A"}
                          </span>
                        </td>
                        <td>{item.currency || "N/A"}</td>
                        <td className={isWithdraw ? "negative" : "positive"}>
                          {formatUsdValue(item.amount, item.currency)}
                        </td>
                        <td>{formatUsdValue(item.availableBalanceAfter, item.currency)}</td>
                        <td>{item.status || "N/A"}</td>
                        <td>{item.bizId || "N/A"}</td>
                        <td>{item.note || "-"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <p className="cash-empty">
                        {loading
                          ? <LoadingInline label="Loading transactions..." size="xs" tone="muted" />
                          : "No transactions yet."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
