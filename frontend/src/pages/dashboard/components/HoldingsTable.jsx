import React from "react";
import LoadingInline from "../../../components/LoadingInline";
import { formatCurrency } from "../../../lib/api";

function fmtCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "N/A";
  }
  return formatCurrency(Math.abs(numeric), "USD");
}

function fmtUsd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "N/A";
  }
  return formatCurrency(numeric, "USD");
}

export default function HoldingsTable({
  holdings,
  selectedSymbol,
  onSelectSymbol,
  isLoading,
  dataUnavailable,
  minRows = 5,
}) {
  const placeholderRows = Array.from({ length: minRows }, (_, index) => `placeholder-${index}`);

  return (
    <>
      <div
        className="card-head"
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span>Current Holdings</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="holdings-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Label</th>
            <th>Shares</th>
            <th>Current Price</th>
            <th>Cost Basis</th>
            <th>Market Value</th>
            <th>Allocation</th>
            <th>P/L</th>
          </tr>
        </thead>
        <tbody>
          {holdings.length > 0 ? holdings.map((holding) => {
            const isSelected = selectedSymbol === holding.symbol;
            return (
              <tr
                key={holding.symbol}
                onClick={() => onSelectSymbol(isSelected ? null : holding.symbol)}
                style={{ background: isSelected ? "rgba(79,123,255,0.08)" : "transparent", cursor: "pointer" }}
              >
                <td>{holding.symbol}</td>
                <td>{holding.companyName}</td>
                <td>{holding.label}</td>
                <td>
                  {Number.isFinite(Number(holding.shares)) ? Number(holding.shares).toFixed(2) : "N/A"}
                </td>
                <td>{fmtUsd(holding.currentPrice)}</td>
                <td>{fmtUsd(holding.costBasis)}</td>
                <td>{fmtUsd(holding.marketValue)}</td>
                <td>
                  {Number.isFinite(Number(holding.allocation)) ? `${Number(holding.allocation).toFixed(2)}%` : "N/A"}
                </td>
                <td style={{ color: Number.isFinite(Number(holding.pnl)) ? (holding.pnl >= 0 ? "#16a34a" : "#dc2626") : "inherit", fontWeight: 700 }}>
                  {Number.isFinite(Number(holding.pnl))
                    ? `${holding.pnl >= 0 ? "+" : "-"}${fmtCurrency(holding.pnl)}`
                    : "N/A"}
                </td>
              </tr>
            );
          }) : placeholderRows.map((rowKey) => (
            <tr key={rowKey}>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      {holdings.length === 0 && (
        <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
          {isLoading
            ? <LoadingInline label="Loading live holdings data..." size="xs" tone="muted" />
            : dataUnavailable
              ? "Live holdings data is unavailable right now."
              : "No holdings data available."}
        </p>
      )}
    </>
  );
}
