import { getTabId } from "./identity";

const SDK_VERSION = "0.1.0";

export interface EventContext {
  platform: "web" | "react-native";
  browser?: string;
  os?: string;
  device_type?: string;
  screen_width?: number;
  screen_height?: number;
  locale?: string;
  timezone?: string;
  sdk_version: string;
  page_url?: string;
  pathname?: string;
  page_title?: string;
  referrer?: string;
  tab_id?: string;
  landing_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function buildContext(): EventContext {
  const ctx: EventContext = {
    platform: "web",
    sdk_version: SDK_VERSION,
  };

  if (!isBrowser()) return ctx;

  if (typeof navigator !== "undefined") {
    ctx.browser = navigator.userAgent;
    ctx.locale = navigator.language;
  }

  if (typeof screen !== "undefined") {
    ctx.screen_width = screen.width;
    ctx.screen_height = screen.height;
  }

  try {
    ctx.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl not available
  }

  ctx.page_url = window.location.href;
  ctx.pathname = window.location.pathname;
  ctx.page_title = document.title;
  ctx.referrer = document.referrer || undefined;
  ctx.os = parseOS(navigator.userAgent);
  ctx.device_type = parseDeviceType(navigator.userAgent);

  const tabId = getTabId();
  if (tabId) ctx.tab_id = tabId;

  ctx.landing_page = getLandingPage();

  const utm = getUtmParams();
  if (utm.utm_source) ctx.utm_source = utm.utm_source;
  if (utm.utm_medium) ctx.utm_medium = utm.utm_medium;
  if (utm.utm_campaign) ctx.utm_campaign = utm.utm_campaign;
  if (utm.utm_term) ctx.utm_term = utm.utm_term;
  if (utm.utm_content) ctx.utm_content = utm.utm_content;

  return ctx;
}

const LANDING_PAGE_KEY = "infer_landing_page";

function getLandingPage(): string {
  try {
    const cached = sessionStorage.getItem(LANDING_PAGE_KEY);
    if (cached) return cached;
    const page = window.location.pathname;
    sessionStorage.setItem(LANDING_PAGE_KEY, page);
    return page;
  } catch {
    return window.location.pathname;
  }
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_SESSION_KEY = "infer_utm";

function getUtmParams(): Partial<Record<(typeof UTM_KEYS)[number], string>> {
  try {
    // Check sessionStorage first (persists across SPA navigations)
    const cached = sessionStorage.getItem(UTM_SESSION_KEY);
    if (cached) return JSON.parse(cached) as Record<string, string>;

    // Parse from current URL
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const val = params.get(key);
      if (val) utm[key] = val;
    }

    // Persist for the session if any UTM params found
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(utm));
    }

    return utm;
  } catch {
    return {};
  }
}

function parseOS(ua: string): string {
  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  if (/CrOS/.test(ua)) return "ChromeOS";
  return "Unknown";
}

function parseDeviceType(ua: string): string {
  if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) return "Mobile";
  if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return "Tablet";
  return "Desktop";
}
