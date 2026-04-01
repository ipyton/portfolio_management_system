import React from "react";

export default function WatchlistSearch({
  searchTerm,
  onSearchChange,
  showSuggestions,
  suggestionRows,
  onFocus,
  onBlur,
  onSuggestionSelect,
}) {
  return (
    <div className="watchlist-search">
      <input
        type="text"
        placeholder="Search"
        aria-label="Search"
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {showSuggestions && suggestionRows.length > 0 && (
        <div className="search-suggestions" role="listbox">
          {suggestionRows.map((row) => (
            <button
              key={`${row.symbol}-${row.assetId ?? "remote"}`}
              type="button"
              className="search-suggestion"
              onClick={() => onSuggestionSelect(row)}
            >
              <span>{row.symbol}</span>
              <span>{row.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
