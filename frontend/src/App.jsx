import React, { useEffect, useState } from "react";
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
import Topbar from "./components/topbar";

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
