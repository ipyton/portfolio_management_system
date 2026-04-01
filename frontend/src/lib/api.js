const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const REQUEST_KEY_HEADER =
  import.meta.env.VITE_REQUEST_KEY_HEADER || "X-Request-Key";
const REQUEST_KEY =
  import.meta.env.VITE_REQUEST_KEY || "ef928c10-2da4-4ca6-9b49-dedc912d5b4c";

export const DEFAULT_USER_ID = Number(import.meta.env.VITE_DEFAULT_USER_ID || 1);

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (REQUEST_KEY) {
    headers.set(REQUEST_KEY_HEADER, REQUEST_KEY);
  }

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.message || payload?.error || "Request failed";
    throw new Error(message);
  }

  return payload;
}

export function formatCurrency(value, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  return `${Number(value * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  const numeric = Number(value) * 100;
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(digits)}%`;
}

export function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function classForDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }

  if (Number(value) > 0) {
    return "positive";
  }

  if (Number(value) < 0) {
    return "negative";
  }

  return "";
}
