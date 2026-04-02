import React, { useEffect, useState } from "react";
import LangflowWidget from "./components/langflow";
import Topbar from "./components/topbar";
import {
  clearAuthPassword,
  hasAuthPassword,
  setAuthPassword,
  verifyAuthPassword,
} from "./lib/api";
import AnalysisPage, { analysisPageMeta } from "./pages/analysis";
import CashPage, { cashPageMeta } from "./pages/cash";
import DashboardPage, { dashboardPageMeta } from "./pages/dashboard";
import WatchlistPage, { watchlistPageMeta } from "./pages/watchlist";

const PAGES = {
  dashboard: {
    label: "Dashboard",
    meta: dashboardPageMeta,
    Component: DashboardPage,
  },
  watchlist: {
    label: "Watchlist",
    meta: watchlistPageMeta,
    Component: WatchlistPage,
  },
  cash: {
    label: "Cash",
    meta: cashPageMeta,
    Component: CashPage,
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
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasAuthPassword());
  const [passwordInput, setPasswordInput] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
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

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    const candidatePassword = String(passwordInput || "");
    if (!candidatePassword.trim()) {
      setAuthError("Please enter the password.");
      return;
    }

    setIsAuthenticating(true);
    try {
      await verifyAuthPassword(candidatePassword);
      setAuthPassword(candidatePassword);
      setIsLoggedIn(true);
      setPasswordInput("");
    } catch (error) {
      clearAuthPassword();
      setIsLoggedIn(false);
      setAuthError(error?.message || "Authentication failed.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handleLogout() {
    clearAuthPassword();
    setIsLoggedIn(false);
    setPasswordInput("");
    setAuthError("");
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <Topbar
        navItems={NAV_ITEMS}
        activePage={activePage}
        onPageChange={setActivePage}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
        theme={theme}
        onThemeToggle={() =>
          setTheme((currentTheme) =>
            currentTheme === "dark" ? "light" : "dark",
          )
        }
      />

      <div className="content-layer">
        <main className="layout">
          {isLoggedIn ? (
            <CurrentPage
              label={pageConfig.label}
              meta={pageConfig.meta}
              isLoggedIn={isLoggedIn}
            />
          ) : (
            <section className="hero-panel auth-gate" aria-live="polite">
              <p className="eyebrow">Authentication Required</p>
              <h1>Enter password to unlock backend access</h1>
              <p className="hero-copy">
                This frontend sends the password as request key for every API call.
              </p>
              <form className="auth-form" onSubmit={handleAuthSubmit}>
                <label htmlFor="auth-password" className="auth-label">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  className="auth-input"
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter fixed password"
                  disabled={isAuthenticating}
                />
                <button
                  type="submit"
                  className="auth-submit"
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? "Verifying..." : "Unlock"}
                </button>
                {authError ? (
                  <p className="auth-error">{authError}</p>
                ) : (
                  <p className="auth-hint">
                    Backend checks this against `REQUEST_KEY`.
                  </p>
                )}
              </form>
            </section>
          )}
        </main>
      </div>

      <LangflowWidget themeMode={theme} />
    </div>
  );
}
