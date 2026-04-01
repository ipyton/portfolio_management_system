import React, { useEffect, useState } from "react";
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
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem("theme");
    return savedTheme === "light" ? "light" : "dark";
  });

  const pageConfig = PAGES[activePage];
  const CurrentPage = pageConfig.Component;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <Topbar
        navItems={NAV_ITEMS}
        activePage={activePage}
        onPageChange={setActivePage}
        isLoggedIn={isLoggedIn}
        onLoginToggle={() => setIsLoggedIn((current) => !current)}
        theme={theme}
        onThemeToggle={() =>
          setTheme((currentTheme) =>
            currentTheme === "dark" ? "light" : "dark",
          )
        }
      />

      <div className="content-layer">
        <main className="layout">
          <CurrentPage label={pageConfig.label} meta={pageConfig.meta} />
        </main>
      </div>
      
      <LangflowWidget />
    </div>
  );
}
