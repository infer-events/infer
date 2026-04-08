import type { InferClient } from "./core";

const SESSION_KEY = "infer_session_last_active";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface AutoTrackConfig {
  pageView: boolean;
  session: boolean;
  click: boolean;
  formSubmit: boolean;
  error: boolean;
}

const defaultAutoTrack: AutoTrackConfig = {
  pageView: true,
  session: true,
  click: true,
  formSubmit: true,
  error: true,
};

export function resolveAutoTrackConfig(
  input: boolean | Partial<AutoTrackConfig>,
): AutoTrackConfig | null {
  if (input === false) return null;
  if (input === true) return { ...defaultAutoTrack };
  return { ...defaultAutoTrack, ...input };
}

type Teardown = () => void;

// Debounce map: key → last fire timestamp
const recentEvents = new Map<string, number>();
const DEBOUNCE_MS = 500;

/** @internal Reset debounce state (for testing only) */
export function _resetDebounce(): void {
  recentEvents.clear();
}

function shouldDebounce(key: string): boolean {
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last && now - last < DEBOUNCE_MS) return true;
  recentEvents.set(key, now);
  // Prevent memory leak: clean up old entries periodically
  if (recentEvents.size > 50) {
    for (const [k, ts] of recentEvents) {
      if (now - ts > DEBOUNCE_MS) recentEvents.delete(k);
    }
  }
  return false;
}

export function setupAutoTracking(
  client: InferClient,
  config: AutoTrackConfig,
): Teardown {
  if (typeof window === "undefined") return () => {};

  const teardowns: Teardown[] = [];

  if (config.session) {
    trackSessionStart(client);
  }

  if (config.pageView) {
    teardowns.push(trackPageViews(client));
  }

  if (config.click) {
    teardowns.push(trackClicks(client));
  }

  if (config.formSubmit) {
    teardowns.push(trackFormSubmits(client));
  }

  if (config.error) {
    teardowns.push(trackErrors(client));
  }

  return () => {
    for (const fn of teardowns) fn();
  };
}

function trackSessionStart(client: InferClient): void {
  try {
    const now = Date.now();
    const lastActive = sessionStorage.getItem(SESSION_KEY);
    const isNewSession =
      !lastActive || now - Number(lastActive) > SESSION_TIMEOUT_MS;

    if (isNewSession) {
      client.trackInternal("session_start", {});
    }

    sessionStorage.setItem(SESSION_KEY, String(now));
  } catch {
    // sessionStorage unavailable
  }
}

function trackPageViews(client: InferClient): Teardown {
  // Track current page
  client.trackInternal("page_view", {
    url: window.location.href,
    path: window.location.pathname,
    title: document.title,
  });

  // Patch History API
  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  const onNavigate = (): void => {
    client.trackInternal("page_view", {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
    });
  };

  history.pushState = function (...args) {
    origPushState(...args);
    onNavigate();
  };

  history.replaceState = function (...args) {
    origReplaceState(...args);
    onNavigate();
  };

  window.addEventListener("popstate", onNavigate);

  return () => {
    history.pushState = origPushState;
    history.replaceState = origReplaceState;
    window.removeEventListener("popstate", onNavigate);
  };
}

function trackClicks(client: InferClient): Teardown {
  const handler = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Walk up to find the nearest interactive element
    const el = target.closest("a, button, [role='button'], input[type='submit']");
    if (!el) return;

    const dedupeKey = `click:${el.id || el.className || el.tagName}`;
    if (shouldDebounce(dedupeKey)) return;

    const props: Record<string, string | number | boolean | null> = {
      tag: el.tagName.toLowerCase(),
    };

    if (el.id) props.element_id = el.id;
    if (el.className && typeof el.className === "string") {
      props.element_class = el.className;
    }
    if (el.tagName === "A") {
      props.href = (el as HTMLAnchorElement).href;
    }

    client.trackInternal("click", props);
  };

  document.addEventListener("click", handler, { capture: true });
  return () => document.removeEventListener("click", handler, { capture: true });
}

function trackFormSubmits(client: InferClient): Teardown {
  const handler = (e: SubmitEvent): void => {
    const form = e.target as HTMLFormElement | null;
    if (!form) return;

    // Defer so the app's onSubmit handler runs first (may call preventDefault)
    queueMicrotask(() => {
      const dedupeKey = `form_submit:${form.id || form.action || ""}`;
      if (shouldDebounce(dedupeKey)) return;

      const props: Record<string, string | number | boolean | null> = {};
      if (form.id) props.form_id = form.id;
      if (form.action) props.form_action = form.action;
      if (form.method) props.form_method = form.method.toUpperCase();
      if (e.defaultPrevented) props.prevented = true;

      client.trackInternal("form_submit", props);
    });
  };

  document.addEventListener("submit", handler, { capture: true });
  return () => document.removeEventListener("submit", handler, { capture: true });
}

/** Truncate a string to maxLen, appending "…" if truncated. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/**
 * Simple 32-bit fingerprint for error grouping.
 * Collision risk: ~65K unique error signatures before birthday paradox applies.
 * Intentionally simple for MVP — upgrade to SHA-256 if product scales.
 */
function errorFingerprint(message: string, filename: string | null, lineno: number | null): string {
  const raw = `${message}|${filename ?? ""}|${lineno ?? ""}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return "err_" + (hash >>> 0).toString(36);
}

/**
 * Filters out errors that aren't from the app itself:
 * - Browser extensions (chrome-extension://, moz-extension://)
 * - Cross-origin script errors (message = "Script error." with no filename)
 * - Browser internals
 */
function shouldIgnoreError(message: string, filename: string | null): boolean {
  if (filename) {
    // Browser extensions
    if (/^(chrome|moz|safari)-extension:\/\//.test(filename)) return true;
    // Browser internal pages
    if (filename.startsWith("about:") || filename.startsWith("chrome://")) return true;
  }
  // Cross-origin script errors (browser blocks details for security)
  if (message === "Script error." && !filename) return true;
  return false;
}

function trackErrors(client: InferClient): Teardown {
  const onError = (e: ErrorEvent): void => {
    const message = e.message || "Unknown error";
    const filename = e.filename || null;

    if (shouldIgnoreError(message, filename)) return;

    const lineno = e.lineno ?? null;
    const stack = e.error instanceof Error && e.error.stack
      ? truncate(e.error.stack, 1024)
      : null;

    client.trackInternal("error", {
      message,
      filename,
      lineno,
      colno: e.colno ?? null,
      stack,
      error_type: "runtime",
      fingerprint: errorFingerprint(message, filename, lineno),
    });
  };

  const onUnhandledRejection = (e: PromiseRejectionEvent): void => {
    const isError = e.reason instanceof Error;
    let message: string;
    if (isError) {
      message = e.reason.message;
    } else if (typeof e.reason === "string") {
      message = e.reason;
    } else {
      try {
        message = "Unhandled promise rejection: " + JSON.stringify(e.reason);
      } catch {
        message = "Unhandled promise rejection";
      }
    }

    const stack = isError && e.reason.stack
      ? truncate(e.reason.stack, 1024)
      : null;

    const filename = isError && e.reason.stack
      ? (e.reason.stack.match(/at\s+.*?\(?(https?:\/\/\S+|\/\S+)/)?.[1] ?? null)
      : null;

    client.trackInternal("error", {
      message,
      type: "unhandledrejection",
      stack,
      error_type: "promise",
      fingerprint: errorFingerprint(message, filename, null),
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
