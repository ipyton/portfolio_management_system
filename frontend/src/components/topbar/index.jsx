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
            <span className="breadcrumb-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* Update the session and authentication logic here. */
function SessionToggle({ isLoggedIn, onLoginToggle }) {
  // Keep login-state switching isolated for easier auth integration later.
  return (
    <button
      type="button"
      className={`session-pill${isLoggedIn ? "" : " offline"}`}
      onClick={onLoginToggle}
    >
      <span className="session-dot" />
      {isLoggedIn ? "Logged in" : "Guest mode"}
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
  onLoginToggle,
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
        <SessionToggle isLoggedIn={isLoggedIn} onLoginToggle={onLoginToggle} />
        <ThemeToggle theme={theme} onThemeToggle={onThemeToggle} />
      </div>
    </header>
  );
}
