import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildContext } from "./context";

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildContext", () => {
  it("returns platform 'web'", () => {
    const ctx = buildContext();
    expect(ctx.platform).toBe("web");
  });

  it("returns sdk_version matching the hardcoded constant", () => {
    const ctx = buildContext();
    expect(ctx.sdk_version).toBe("0.1.0");
  });

  it("includes page_url from window.location", () => {
    const ctx = buildContext();
    expect(ctx.page_url).toBe(window.location.href);
  });

  it("includes pathname from window.location", () => {
    const ctx = buildContext();
    expect(ctx.pathname).toBe(window.location.pathname);
  });

  it("includes page_title from document.title", () => {
    const original = document.title;
    document.title = "Test Page Title";
    const ctx = buildContext();
    expect(ctx.page_title).toBe("Test Page Title");
    document.title = original;
  });

  it("includes browser (user agent string)", () => {
    const ctx = buildContext();
    expect(ctx.browser).toBe(navigator.userAgent);
  });

  it("includes locale from navigator.language", () => {
    const ctx = buildContext();
    expect(ctx.locale).toBe(navigator.language);
  });

  it("includes screen dimensions", () => {
    const ctx = buildContext();
    expect(ctx.screen_width).toBe(screen.width);
    expect(ctx.screen_height).toBe(screen.height);
  });

  it("includes timezone matching Intl API", () => {
    const ctx = buildContext();
    expect(ctx.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("sets referrer to undefined when document.referrer is empty", () => {
    // jsdom sets document.referrer to empty string by default
    // source: `ctx.referrer = document.referrer || undefined`
    const ctx = buildContext();
    expect(ctx.referrer).toBeUndefined();
  });

  it("includes tab_id when sessionStorage is available", () => {
    const ctx = buildContext();
    expect(ctx.tab_id).toBeDefined();
    expect(ctx.tab_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("parseOS (tested via buildContext)", () => {
  function buildContextWithUA(ua: string) {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
    return buildContext();
  }

  it("Windows user agent returns 'Windows'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    );
    expect(ctx.os).toBe("Windows");
  });

  it("Mac user agent returns 'macOS'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    );
    expect(ctx.os).toBe("macOS");
  });

  it("iPhone user agent returns 'iOS'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    expect(ctx.os).toBe("iOS");
  });

  it("Android user agent returns 'Android'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36",
    );
    expect(ctx.os).toBe("Android");
  });

  it("Linux user agent returns 'Linux'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    );
    expect(ctx.os).toBe("Linux");
  });
});

describe("parseDeviceType (tested via buildContext)", () => {
  function buildContextWithUA(ua: string) {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
    return buildContext();
  }

  it("iPhone user agent returns 'Mobile'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    expect(ctx.device_type).toBe("Mobile");
  });

  it("iPad user agent returns 'Tablet'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    expect(ctx.device_type).toBe("Tablet");
  });

  it("Desktop user agent returns 'Desktop'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    );
    expect(ctx.device_type).toBe("Desktop");
  });

  it("Android Mobile user agent returns 'Mobile'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
    );
    expect(ctx.device_type).toBe("Mobile");
  });

  it("Android Tablet user agent returns 'Tablet'", () => {
    const ctx = buildContextWithUA(
      "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    );
    expect(ctx.device_type).toBe("Tablet");
  });
});
