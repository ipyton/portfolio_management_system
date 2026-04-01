import React from "react";

export default function CategoryTabs({ categories, activeId, onChange }) {
  // Keep category navigation stateless and driven by parent state.
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {categories.map((category) => {
        const isActive = category.id === activeId;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            style={{
              border: `1px solid ${isActive ? category.accent : "rgba(108,125,158,0.24)"}`,
              color: isActive ? category.accent : "var(--muted)",
              background: "var(--panel)",
              borderRadius: 999,
              padding: "8px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
