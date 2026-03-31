import React, { useState } from "react";
import LangflowWidget from "./components/langflow";
import AnalyticsPage, {
  analyticsActivityFeed,
  analyticsPageMeta,
} from "./pages/analytics";
import DashboardPage, {
  dashboardActivityFeed,
  dashboardPageMeta,
} from "./pages/dashboard";
import WatchlistPage, {
  watchlistActivityFeed,
  watchlistPageMeta,
} from "./pages/watchlist";

const PAGES = {
  dashboard: {
    label: "Dashboard",
    meta: dashboardPageMeta,
    activityFeed: dashboardActivityFeed,
    Component: DashboardPage,
  },
  watchlist: {
    label: "Watchlist",
    meta: watchlistPageMeta,
    activityFeed: watchlistActivityFeed,
    Component: WatchlistPage,
  },
  analytics: {
    label: "Analytics",
    meta: analyticsPageMeta,
    activityFeed: analyticsActivityFeed,
    Component: AnalyticsPage,
  },
};

const NAV_ITEMS = Object.entries(PAGES).map(([id, config]) => ({
  id,
  label: config.label,
  eyebrow: config.meta.eyebrow,
}));

export default function App() {
  const [activePage, setActivePage] = useState("analytics");
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
            <p className="brand-kicker">Portfolio Management System</p>
            <strong className="brand-name">Global Markets Control Room</strong>
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
          <CurrentPage
            label={pageConfig.label}
            meta={pageConfig.meta}
            activityFeed={pageConfig.activityFeed}
            isLoggedIn={isLoggedIn}
          />
        </main>
      </div>

      <LangflowWidget />
    </div>
  );
}
