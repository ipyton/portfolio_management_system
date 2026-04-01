import React from "react";
import { FormControlLabel, Switch } from "@mui/material";

function BrandLockup() {
  // Keep the logo and brand copy centered on the same vertical axis.
  return (
    <div className="brand-lockup">
      <img src="/logo.png" alt="HSBC logo" className="brand-logo-image" />
      <div className="brand-copy">
        <p className="brand-kicker">Portfolio Management System</p>
        <strong className="brand-name">INVEST GLOBALLY</strong>
      </div>
    </div>
  );
}

function NavigationLinks({ navItems, activePage, onPageChange }) {
  // Assign a tone class by index so each tab has a different accent color.
  return (
    <nav className="breadcrumb-nav" aria-label="Primary">
      {navItems.map((item, index) => {
        const isActive = item.id === activePage;
        const toneClass = `nav-tone-${index % 3}`;
        return (
          <button
            key={item.id}
            type="button"
            className={`breadcrumb-link ${toneClass}${isActive ? " active" : ""}`}
            onClick={() => onPageChange(item.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* Display authentication state and logout action. */
function SessionState({ isLoggedIn, onLogout }) {
  if (!isLoggedIn) {
    return (
      <span className="session-pill offline" role="status" aria-live="polite">
        <span className="session-dot" />
        Locked
      </span>
    );
  }

  return (
    <button type="button" className="session-pill" onClick={onLogout}>
      <span className="session-dot" />
      Log out
    </button>
  );
}

/* Update the Theme Switch Logic here. */
function ThemeToggle({ theme, onThemeToggle }) {
  // Mirror the current theme state with a readable action label.
  return (
    <FormControlLabel
      className="theme-switch"
      control={
        <Switch
          checked={theme === "dark"}
          onChange={() => onThemeToggle()}
          inputProps={{ "aria-label": "Toggle theme" }}
        />
      }
      label={theme === "dark" ? "Black Mode" : "White Mode"}
    />
  );
}

export default function Topbar({
  navItems,
  activePage,
  onPageChange,
  isLoggedIn,
  onLogout,
  theme,
  onThemeToggle,
}) {
  // Compose all topbar building blocks in one place.
  return (
    <header className="topbar">
      <BrandLockup />
      <div className="topbar-actions">
        <NavigationLinks
          navItems={navItems}
          activePage={activePage}
          onPageChange={onPageChange}
        />
        <SessionState isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <ThemeToggle theme={theme} onThemeToggle={onThemeToggle} />
      </div>
    </header>
  );
}
