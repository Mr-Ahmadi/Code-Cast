import axios from "axios";

/**
 * Where the online-mode backend lives, and how the client talks to it.
 *
 * The default is an empty string, meaning "same origin" — in the browser that
 * routes through the Vite dev proxy exactly as before. A packaged desktop
 * build has no origin to speak of, so it falls back to the conventional local
 * server. Either way the user can point the app at any reachable endpoint.
 */

const URL_KEY = "codecast_server_url";
const TOKEN_KEY = "codecast_auth_token";

const ELECTRON_DEFAULT = "http://localhost:4000";

/** Endpoints offered in the UI as one-click presets. */
export const PRESET_ENDPOINTS = [
  { label: "Same origin (dev proxy)", url: "" },
  { label: "Local server", url: "http://localhost:4000" },
];

const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try {
      fn(getServerUrl());
    } catch {
      /* a bad listener must not break the others */
    }
  }
}

/** Subscribe to endpoint changes. Returns an unsubscribe function. */
export function onServerUrlChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The endpoint used when the user has never chosen one. */
export function getDefaultServerUrl() {
  return window.electronAPI?.isElectron ? ELECTRON_DEFAULT : "";
}

/**
 * Trim a user-typed endpoint into something axios can use as a baseURL:
 * no trailing slash, and a scheme even if the user only typed a host:port.
 */
export function normalizeServerUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return "";

  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;

  try {
    const url = new URL(withScheme);
    // Drop query and hash; a base URL is only origin + path.
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path}`;
  } catch {
    return withScheme.replace(/\/+$/, "");
  }
}

/** Explain why an endpoint is unusable, or null when it looks fine. */
export function validateServerUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return null; // empty means "same origin", which is valid

  const normalized = normalizeServerUrl(value);
  try {
    const url = new URL(normalized);
    if (!url.hostname) return "Missing a host name.";
    return null;
  } catch {
    return "That does not look like a valid URL.";
  }
}

/** The endpoint currently in use. */
export function getServerUrl() {
  try {
    const saved = localStorage.getItem(URL_KEY);
    if (saved !== null) return saved;
  } catch {
    /* storage can be unavailable; fall through to the default */
  }
  return getDefaultServerUrl();
}

/** True when the user has explicitly chosen an endpoint. */
export function hasCustomServerUrl() {
  try {
    return localStorage.getItem(URL_KEY) !== null;
  } catch {
    return false;
  }
}

/** Persist an endpoint and route all subsequent requests to it. */
export function setServerUrl(raw) {
  const normalized = normalizeServerUrl(raw);
  try {
    localStorage.setItem(URL_KEY, normalized);
  } catch {
    /* a failed write still applies for this session */
  }
  applyServerConfig();
  notify();
  return normalized;
}

/** Forget the user's choice and go back to the built-in default. */
export function resetServerUrl() {
  try {
    localStorage.removeItem(URL_KEY);
  } catch {
    /* nothing to undo */
  }
  applyServerConfig();
  notify();
  return getServerUrl();
}

/** How the endpoint should read in the UI. */
export function describeServerUrl(url = getServerUrl()) {
  if (!url) return `${window.location.origin} (same origin)`;
  return url;
}

// --- Auth token -----------------------------------------------------------
// A cookie only reaches the client when the API shares its origin. Against a
// remote endpoint the client keeps its own copy of the token and sends it as
// a bearer header instead.

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* the in-memory axios header below still applies */
  }
  applyAuthHeader();
}

export function clearAuthToken() {
  setAuthToken(null);
}

function applyAuthHeader() {
  const token = getAuthToken();
  if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axios.defaults.headers.common.Authorization;
}

// --- Wiring ---------------------------------------------------------------

/**
 * Point axios at the configured endpoint. Call once at start-up and again
 * whenever the endpoint changes.
 */
export function applyServerConfig() {
  const base = getServerUrl();
  // axios treats "" as "resolve against the current origin", which is what
  // the dev proxy needs.
  axios.defaults.baseURL = base ? `${base}/` : "/";
  axios.defaults.withCredentials = true;
  applyAuthHeader();
}

/** Absolute URL for a REST path against the current endpoint. */
export function apiUrl(path = "") {
  const clean = String(path).replace(/^\/+/, "");
  const base = getServerUrl();
  if (!base) return `${window.location.origin}/${clean}`;
  return `${base}/${clean}`;
}

/** WebSocket URL for a path against the current endpoint. */
export function wsUrl(path = "") {
  const clean = String(path).replace(/^\/+/, "");
  const base = getServerUrl();

  if (!base) {
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${scheme}//${window.location.host}/${clean}`;
  }

  try {
    const url = new URL(base);
    const scheme = url.protocol === "https:" ? "wss:" : "ws:";
    const prefix = url.pathname.replace(/\/+$/, "");
    return `${scheme}//${url.host}${prefix}/${clean}`;
  } catch {
    return `${base.replace(/^http/i, "ws")}/${clean}`;
  }
}

/**
 * Probe an endpoint's /health route.
 * Resolves to { ok, status, message, detail } — never throws.
 */
export async function testServerConnection(raw, { timeoutMs = 6000 } = {}) {
  const target = raw === undefined ? getServerUrl() : normalizeServerUrl(raw);
  const url = target
    ? `${target}/health`
    : `${window.location.origin}/health`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
    const ms = Date.now() - started;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: `Server responded with ${res.status}`,
        detail: `${url} — the endpoint is reachable but did not accept the health check.`,
      };
    }

    // Insist on the identifying payload. Plenty of things answer 200 on an
    // unknown path — a dev server, a proxy, a captive portal — and calling any
    // of them a working endpoint would send the user off debugging the wrong
    // thing later.
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* handled below as "not a Code Cast server" */
    }

    if (!body || body.service !== "code-cast-server") {
      return {
        ok: false,
        status: res.status,
        message: "Not a Code Cast server",
        detail: `${url} answered, but did not identify itself as a Code Cast server. Check the address, or update the server if it predates the /health endpoint.`,
      };
    }

    const dbDown = body.database === "down";
    return {
      ok: !dbDown,
      status: res.status,
      message: dbDown
        ? "Reachable, but its database is down"
        : `Connected in ${ms} ms`,
      detail: dbDown
        ? `Code Cast server${body.version ? ` v${body.version}` : ""} is running, but cannot reach its database, so sign-in will fail.`
        : `Code Cast server${body.version ? ` v${body.version}` : ""}`,
    };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      message: aborted ? "Timed out" : "Could not reach the server",
      detail: aborted
        ? `${url} did not answer within ${Math.round(timeoutMs / 1000)}s.`
        : `${url} — check the address, and that the server is running and allows this origin.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
