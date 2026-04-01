import React, { useState } from "react";
import LangflowWidget from "./components/langflow";
import AnalysisPage, { analysisPageMeta } from "./pages/analysis";
import AnalyticsPage, { analyticsPageMeta } from "./pages/analytics";
import WatchlistPage, { watchlistPageMeta } from "./pages/watchlist";

const PAGES = {
  dashboard: {
    label: "Dashboard",
    meta: analyticsPageMeta,
    Component: AnalyticsPage,
  },
  watchlist: {
    label: "Watchlist",
    meta: watchlistPageMeta,
    Component: WatchlistPage,
  },
  analysis: {
    label: "Analysis",
    meta: analysisPageMeta,
    Component: AnalysisPage,
  },
};

const NAV_ITEMS = Object.entries(PAGES).map(([id, config]) => ({
  id,
  label: config.label,
  eyebrow: config.meta.eyebrow,
}));

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const pageConfig = PAGES[activePage];
  const CurrentPage = pageConfig.Component;

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <div className="brand-lockup">
          <img src="/logo.png" alt="HSBC logo" className="brand-logo-image" />
          <div className="brand-copy">
            <strong className="brand-name">PiggyBank</strong>
          </div>
        </div>

        <div className="topbar-actions">
          <nav className="breadcrumb-nav" aria-label="Primary">
            {NAV_ITEMS.map((item, index) => {
              const isActive = item.id === activePage;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`breadcrumb-link${isActive ? " active" : ""}`}
                  onClick={() => setActivePage(item.id)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="breadcrumb-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            className={`session-pill${isLoggedIn ? "" : " offline"}`}
            onClick={() => setIsLoggedIn((current) => !current)}
          >
            <span className="session-dot" />
            {isLoggedIn ? "Logged in" : "Guest mode"}
          </button>
        </div>
      </header>

      <div className="content-layer">
        <main className="layout">
          <CurrentPage label={pageConfig.label} meta={pageConfig.meta} />
        </main>
      </div>

      <LangflowWidget />
    </div>
  );
}
