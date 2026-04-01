import React from "react";

export default function StockAddForm({ form, onChange, onSubmit }) {
  // Keep the add-flow controlled by parent state.
  return (
    <form className="stock-form" onSubmit={onSubmit} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(6,minmax(0,1fr))", marginBottom: 14 }}>
      <input name="symbol" value={form.symbol} onChange={onChange} placeholder="Symbol" required />
      <input name="companyName" value={form.companyName} onChange={onChange} placeholder="Company" required />
      <input name="label" value={form.label} onChange={onChange} placeholder="Label" required />
      <input name="shares" value={form.shares} onChange={onChange} placeholder="Shares" type="number" min="1" required />
      <input name="currentPrice" value={form.currentPrice} onChange={onChange} placeholder="Price" type="number" step="0.01" min="0" required />
      <button type="submit" className="theme-pill">Add Stock</button>
    </form>
  );
}
