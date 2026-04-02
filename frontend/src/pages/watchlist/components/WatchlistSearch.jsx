import React from "react";
import LoadingInline from "../../../components/LoadingInline";

export default function WatchlistSearch({
  searchTerm,
  isSearching,
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
      {isSearching && (
        <span className="watchlist-search-loading" aria-hidden="true">
          <LoadingInline size="xs" tone="muted" />
        </span>
      )}
      {showSuggestions && (isSearching || suggestionRows.length > 0) && (
        <div className="search-suggestions" role="listbox">
          {isSearching ? (
            <div className="search-suggestion search-suggestion-loading">
              <LoadingInline label="Searching..." size="xs" tone="muted" />
            </div>
          ) : (
            suggestionRows.map((row) => (
              <button
                key={`${row.symbol}-${row.assetId ?? "remote"}`}
                type="button"
                className="search-suggestion"
                onClick={() => onSuggestionSelect(row)}
              >
                <span>{row.symbol}</span>
                <span>{row.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
