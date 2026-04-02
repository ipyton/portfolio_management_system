const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const REQUEST_KEY_HEADER =
  import.meta.env.VITE_REQUEST_KEY_HEADER || "X-Request-Key";
const AUTH_PASSWORD_STORAGE_KEY = "portfolio-auth-password";
const USD_CURRENCY_CODE = "USD";

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage;
}

function readStoredAuthPassword() {
  const storage = getSessionStorage();
  if (!storage) {
    return "";
  }
  return storage.getItem(AUTH_PASSWORD_STORAGE_KEY) || "";
}

let authPassword = readStoredAuthPassword();

export const DEFAULT_USER_ID = Number(import.meta.env.VITE_DEFAULT_USER_ID || 1);

function resolveErrorMessage(payload, fallbackMessage) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  return fallbackMessage;
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function createHttpError(response, payload, fallbackMessage) {
  const error = new Error(resolveErrorMessage(payload, fallbackMessage));
  error.status = response.status;
  error.payload = payload;
  return error;
}

export function hasAuthPassword() {
  return Boolean(authPassword);
}

export function setAuthPassword(nextPassword) {
  authPassword = String(nextPassword || "");
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  if (authPassword) {
    storage.setItem(AUTH_PASSWORD_STORAGE_KEY, authPassword);
    return;
  }
  storage.removeItem(AUTH_PASSWORD_STORAGE_KEY);
}

export function clearAuthPassword() {
  setAuthPassword("");
}

export async function verifyAuthPassword(candidatePassword) {
  const password = String(candidatePassword || "");
  if (!password.trim()) {
    throw new Error("Password is required");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
    method: "GET",
    headers: {
      [REQUEST_KEY_HEADER]: password,
    },
  });
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw createHttpError(response, payload, "Authentication failed");
  }

  return payload;
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (authPassword) {
    headers.set(REQUEST_KEY_HEADER, authPassword);
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

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw createHttpError(response, payload, "Request failed");
  }

  return payload;
}

export async function fetchCashBalances(userId = DEFAULT_USER_ID) {
  return apiFetch(`/api/cash-accounts?userId=${encodeURIComponent(userId)}`);
}

export async function fetchCashTransactions({
  userId = DEFAULT_USER_ID,
  currency,
} = {}) {
  const params = new URLSearchParams({ userId: String(userId) });
  if (currency && String(currency).trim()) {
    params.set("currency", String(currency).trim().toUpperCase());
  }
  return apiFetch(`/api/cash-accounts/transactions?${params.toString()}`);
}

export async function mockCashDeposit(requestBody) {
  return apiFetch("/api/cash-accounts/deposit", {
    method: "POST",
    body: requestBody,
  });
}

export async function mockCashWithdraw(requestBody) {
  return apiFetch("/api/cash-accounts/withdraw", {
    method: "POST",
    body: requestBody,
  });
}

function normalizeCurrencyCode(currency) {
  const normalized = String(currency || "").trim().toUpperCase();
  return normalized || null;
}

export async function fetchFxLatest(quoteCurrency = USD_CURRENCY_CODE) {
  const normalizedQuote = normalizeCurrencyCode(quoteCurrency) || USD_CURRENCY_CODE;
  return apiFetch(`/api/fx/latest?quoteCurrency=${encodeURIComponent(normalizedQuote)}`);
}

export function buildFxRateMap(snapshot, quoteCurrency = USD_CURRENCY_CODE) {
  const normalizedQuote = normalizeCurrencyCode(quoteCurrency) || USD_CURRENCY_CODE;
  const fxRateMap = { [normalizedQuote]: 1 };
  const rates = Array.isArray(snapshot?.rates) ? snapshot.rates : [];
  rates.forEach((item) => {
    const baseCurrency = normalizeCurrencyCode(item?.baseCurrency);
    const rate = Number(item?.rate);
    if (!baseCurrency || !Number.isFinite(rate) || rate <= 0) {
      return;
    }
    fxRateMap[baseCurrency] = rate;
  });
  return fxRateMap;
}

export function convertAmountByFx(value, fromCurrency, fxRateMap, quoteCurrency = USD_CURRENCY_CODE) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const normalizedQuote = normalizeCurrencyCode(quoteCurrency) || USD_CURRENCY_CODE;
  const normalizedFrom = normalizeCurrencyCode(fromCurrency) || normalizedQuote;
  if (normalizedFrom === normalizedQuote) {
    return numeric;
  }
  const rate = Number(fxRateMap?.[normalizedFrom]);
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return numeric * rate;
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
