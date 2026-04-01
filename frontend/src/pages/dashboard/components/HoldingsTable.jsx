import React from "react";

function fmtCurrency(value) {
  return `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
      <div className="card-head" style={{ marginBottom: 12 }}>
        <span>Current Holdings</span>
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
                <td style={{ background: isSelectedColumn("shares") ? "rgba(79,123,255,0.04)" : "transparent" }}>{holding.shares}</td>
                <td style={{ background: isSelectedColumn("currentPrice") ? "rgba(79,123,255,0.04)" : "transparent" }}>${holding.currentPrice.toFixed(2)}</td>
                <td style={{ background: isSelectedColumn("costBasis") ? "rgba(79,123,255,0.04)" : "transparent" }}>${holding.costBasis.toFixed(2)}</td>
                <td style={{ background: isSelectedColumn("marketValue") ? "rgba(79,123,255,0.04)" : "transparent" }}>${holding.marketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td style={{ background: isSelectedColumn("allocation") ? "rgba(79,123,255,0.04)" : "transparent" }}>{holding.allocation.toFixed(2)}%</td>
                <td style={{ background: isSelectedColumn("pnl") ? "rgba(79,123,255,0.04)" : "transparent", color: holding.pnl >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                  {holding.pnl >= 0 ? "+" : "-"}
                  {fmtCurrency(holding.pnl)}
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
