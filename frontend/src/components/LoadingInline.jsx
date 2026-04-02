import React from "react";

function joinClassNames(...names) {
  return names.filter(Boolean).join(" ");
}

export default function LoadingInline({
  label = "",
  size = "sm",
  tone = "default",
  className = "",
}) {
  const wrapperClassName = joinClassNames("loading-inline", className);
  const spinnerClassName = joinClassNames(
    "loading-spinner",
    `loading-spinner--${size}`,
    tone !== "default" ? `loading-spinner--${tone}` : "",
  );

  return (
    <span className={wrapperClassName} role="status" aria-live="polite">
      <span className={spinnerClassName} aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
