import React from "react";
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

export const HOLDING_COLUMN_OPTIONS = [
  { key: "symbol", label: "Symbol" },
  { key: "companyName", label: "Company" },
  { key: "label", label: "Label" },
  { key: "shares", label: "Shares" },
  { key: "currentPrice", label: "Current Price" },
  { key: "costBasis", label: "Cost Basis" },
  { key: "marketValue", label: "Market Value" },
  { key: "allocation", label: "Allocation" },
  { key: "pnl", label: "P/L" },
];

export default function HoldingsTable({
  holdings,
  selectedSymbol,
  onSelectSymbol,
  selectedColumn,
  onColumnChange,
  isLoading,
  dataUnavailable,
  minRows = 5,
}) {
  const isSelectedColumn = (columnKey) => selectedColumn === columnKey;
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
        <label htmlFor="holdings-highlight-column" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Highlight
          </span>
          <select
            id="holdings-highlight-column"
            className="card-select"
            value={selectedColumn}
            onChange={(event) => onColumnChange(event.target.value)}
          >
            {HOLDING_COLUMN_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="holdings-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
        <thead>
          <tr>
            <th style={{ background: isSelectedColumn("symbol") ? "rgba(79,123,255,0.08)" : "transparent" }}>Symbol</th>
            <th style={{ background: isSelectedColumn("companyName") ? "rgba(79,123,255,0.08)" : "transparent" }}>Company</th>
            <th style={{ background: isSelectedColumn("label") ? "rgba(79,123,255,0.08)" : "transparent" }}>Label</th>
            <th style={{ background: isSelectedColumn("shares") ? "rgba(79,123,255,0.08)" : "transparent" }}>Shares</th>
            <th style={{ background: isSelectedColumn("currentPrice") ? "rgba(79,123,255,0.08)" : "transparent" }}>Current Price</th>
            <th style={{ background: isSelectedColumn("costBasis") ? "rgba(79,123,255,0.08)" : "transparent" }}>Cost Basis</th>
            <th style={{ background: isSelectedColumn("marketValue") ? "rgba(79,123,255,0.08)" : "transparent" }}>Market Value</th>
            <th style={{ background: isSelectedColumn("allocation") ? "rgba(79,123,255,0.08)" : "transparent" }}>Allocation</th>
            <th style={{ background: isSelectedColumn("pnl") ? "rgba(79,123,255,0.08)" : "transparent" }}>P/L</th>
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
                <td style={{ background: isSelectedColumn("symbol") ? "rgba(79,123,255,0.04)" : "transparent" }}>{holding.symbol}</td>
                <td style={{ background: isSelectedColumn("companyName") ? "rgba(79,123,255,0.04)" : "transparent" }}>{holding.companyName}</td>
                <td style={{ background: isSelectedColumn("label") ? "rgba(79,123,255,0.04)" : "transparent" }}>{holding.label}</td>
                <td style={{ background: isSelectedColumn("shares") ? "rgba(79,123,255,0.04)" : "transparent" }}>
                  {Number.isFinite(Number(holding.shares)) ? Number(holding.shares).toFixed(2) : "N/A"}
                </td>
                <td style={{ background: isSelectedColumn("currentPrice") ? "rgba(79,123,255,0.04)" : "transparent" }}>{fmtUsd(holding.currentPrice)}</td>
                <td style={{ background: isSelectedColumn("costBasis") ? "rgba(79,123,255,0.04)" : "transparent" }}>{fmtUsd(holding.costBasis)}</td>
                <td style={{ background: isSelectedColumn("marketValue") ? "rgba(79,123,255,0.04)" : "transparent" }}>{fmtUsd(holding.marketValue)}</td>
                <td style={{ background: isSelectedColumn("allocation") ? "rgba(79,123,255,0.04)" : "transparent" }}>
                  {Number.isFinite(Number(holding.allocation)) ? `${Number(holding.allocation).toFixed(2)}%` : "N/A"}
                </td>
                <td style={{ background: isSelectedColumn("pnl") ? "rgba(79,123,255,0.04)" : "transparent", color: Number.isFinite(Number(holding.pnl)) ? (holding.pnl >= 0 ? "#16a34a" : "#dc2626") : "inherit", fontWeight: 700 }}>
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
            ? "Loading live holdings data..."
            : dataUnavailable
              ? "Live holdings data is unavailable right now."
              : "No holdings data available."}
        </p>
      )}
    </>
  );
}
