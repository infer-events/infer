import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveAutoTrackConfig,
  setupAutoTracking,
  _resetDebounce,
  type AutoTrackConfig,
} from "./auto-track";
import type { InferClient } from "./core";

function createMockClient() {
  return {
    trackInternal: vi.fn(),
  } as unknown as InferClient;
}

describe("resolveAutoTrackConfig", () => {
  it("returns null when input is false", () => {
    expect(resolveAutoTrackConfig(false)).toBeNull();
  });

  it("returns all defaults enabled when input is true", () => {
    const config = resolveAutoTrackConfig(true);
    expect(config).toEqual({
      pageView: true,
      session: true,
      click: true,
      formSubmit: true,
      error: true,
    });
  });

  it("merges partial config with defaults", () => {
    const config = resolveAutoTrackConfig({ click: false, session: false });
    expect(config).toEqual({
      pageView: true,
      session: false,
      click: false,
      formSubmit: true,
      error: true,
    });
  });

  it("does not mutate the defaults object", () => {
    const first = resolveAutoTrackConfig(true);
    const second = resolveAutoTrackConfig(true);
    expect(first).not.toBe(second);
  });
});

describe("setupAutoTracking", () => {
  let mockClient: InferClient;

  beforeEach(() => {
    mockClient = createMockClient();
    sessionStorage.clear();
    localStorage.clear();
    _resetDebounce();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns a teardown function", () => {
    const teardown = setupAutoTracking(mockClient, {
      pageView: false,
      session: false,
      click: false,
      formSubmit: false,
      error: false,
    });
    expect(typeof teardown).toBe("function");
    teardown();
  });

  describe("session tracking", () => {
    const sessionConfig: AutoTrackConfig = {
      pageView: false,
      session: true,
      click: false,
      formSubmit: false,
      error: false,
    };

    it("fires session_start when no prior session exists", () => {
      const teardown = setupAutoTracking(mockClient, sessionConfig);
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "session_start",
        {},
      );
      teardown();
    });

    it("fires session_start when session expired (>30 min)", () => {
      const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
      sessionStorage.setItem("infer_session_last_active", String(thirtyOneMinutesAgo));

      const teardown = setupAutoTracking(mockClient, sessionConfig);
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "session_start",
        {},
      );
      teardown();
    });

    it("does NOT fire session_start when session is still active", () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      sessionStorage.setItem("infer_session_last_active", String(fiveMinutesAgo));

      const teardown = setupAutoTracking(mockClient, sessionConfig);
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      teardown();
    });

    it("updates sessionStorage with current timestamp", () => {
      const teardown = setupAutoTracking(mockClient, sessionConfig);
      const stored = sessionStorage.getItem("infer_session_last_active");
      expect(stored).toBeTruthy();
      expect(Number(stored)).toBeCloseTo(Date.now(), -2);
      teardown();
    });
  });

  describe("page view tracking", () => {
    const pageViewConfig: AutoTrackConfig = {
      pageView: true,
      session: false,
      click: false,
      formSubmit: false,
      error: false,
    };

    it("fires page_view on setup with current URL info", () => {
      const teardown = setupAutoTracking(mockClient, pageViewConfig);
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "page_view",
        expect.objectContaining({
          url: window.location.href,
          path: window.location.pathname,
          title: document.title,
        }),
      );
      teardown();
    });

    it("fires page_view on history.pushState", () => {
      const teardown = setupAutoTracking(mockClient, pageViewConfig);
      (mockClient.trackInternal as ReturnType<typeof vi.fn>).mockClear();

      history.pushState({}, "", "/new-page");
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "page_view",
        expect.objectContaining({
          path: "/new-page",
        }),
      );
      teardown();
    });

    it("fires page_view on history.replaceState", () => {
      const teardown = setupAutoTracking(mockClient, pageViewConfig);
      (mockClient.trackInternal as ReturnType<typeof vi.fn>).mockClear();

      history.replaceState({}, "", "/replaced-page");
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "page_view",
        expect.objectContaining({
          path: "/replaced-page",
        }),
      );
      teardown();
    });

    it("fires page_view on popstate event", () => {
      const teardown = setupAutoTracking(mockClient, pageViewConfig);
      (mockClient.trackInternal as ReturnType<typeof vi.fn>).mockClear();

      window.dispatchEvent(new PopStateEvent("popstate"));
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "page_view",
        expect.objectContaining({
          url: expect.any(String),
          path: expect.any(String),
        }),
      );
      teardown();
    });

    it("teardown restores original pushState and replaceState", () => {
      const origPush = history.pushState;
      const origReplace = history.replaceState;

      const teardown = setupAutoTracking(mockClient, pageViewConfig);
      // After setup, pushState/replaceState should be patched
      expect(history.pushState).not.toBe(origPush);
      expect(history.replaceState).not.toBe(origReplace);

      teardown();
      // After teardown, originals should be restored
      // The originals were bound versions, so they won't be === origPush,
      // but they should no longer trigger tracking
      (mockClient.trackInternal as ReturnType<typeof vi.fn>).mockClear();
      history.pushState({}, "", "/after-teardown");
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });
  });

  describe("click tracking", () => {
    const clickConfig: AutoTrackConfig = {
      pageView: false,
      session: false,
      click: true,
      formSubmit: false,
      error: false,
    };

    it("fires click event for button elements", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const button = document.createElement("button");
      button.textContent = "Click me";
      document.body.appendChild(button);
      button.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "click",
        expect.objectContaining({ tag: "button" }),
      );

      document.body.removeChild(button);
      teardown();
    });

    it("fires click event for anchor elements with href", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const anchor = document.createElement("a");
      anchor.href = "https://example.com";
      anchor.textContent = "Link";
      document.body.appendChild(anchor);
      anchor.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "click",
        expect.objectContaining({
          tag: "a",
          href: "https://example.com/",
        }),
      );

      document.body.removeChild(anchor);
      teardown();
    });

    it("fires click event for elements with role='button'", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const div = document.createElement("div");
      div.setAttribute("role", "button");
      div.textContent = "Custom button";
      document.body.appendChild(div);
      div.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "click",
        expect.objectContaining({ tag: "div" }),
      );

      document.body.removeChild(div);
      teardown();
    });

    it("does NOT fire for non-interactive elements (div, span)", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const div = document.createElement("div");
      div.textContent = "Not interactive";
      document.body.appendChild(div);
      div.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();

      const span = document.createElement("span");
      span.textContent = "Also not interactive";
      document.body.appendChild(span);
      span.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();

      document.body.removeChild(div);
      document.body.removeChild(span);
      teardown();
    });

    it("captures element_id and element_class", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const button = document.createElement("button");
      button.id = "submit-btn";
      button.className = "btn btn-primary";
      document.body.appendChild(button);
      button.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "click",
        expect.objectContaining({
          element_id: "submit-btn",
          element_class: "btn btn-primary",
        }),
      );

      document.body.removeChild(button);
      teardown();
    });

    it("debounces rapid clicks on the same element within 500ms", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const button = document.createElement("button");
      button.id = "debounce-test";
      document.body.appendChild(button);

      button.click();
      button.click();
      button.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

      document.body.removeChild(button);
      teardown();
    });

    it("fires again after debounce window passes", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const button = document.createElement("button");
      button.id = "debounce-expire-test";
      document.body.appendChild(button);

      button.click();
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(501);

      button.click();
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);

      document.body.removeChild(button);
      teardown();
    });

    it("different elements are NOT debounced against each other", () => {
      const teardown = setupAutoTracking(mockClient, clickConfig);

      const button1 = document.createElement("button");
      button1.id = "btn-1";
      document.body.appendChild(button1);

      const button2 = document.createElement("button");
      button2.id = "btn-2";
      document.body.appendChild(button2);

      button1.click();
      button2.click();

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);

      document.body.removeChild(button1);
      document.body.removeChild(button2);
      teardown();
    });
  });

  describe("form submit tracking", () => {
    const formConfig: AutoTrackConfig = {
      pageView: false,
      session: false,
      click: false,
      formSubmit: true,
      error: false,
    };

    it("fires form_submit with form_id, form_action, form_method", async () => {
      const teardown = setupAutoTracking(mockClient, formConfig);

      const form = document.createElement("form");
      form.id = "signup-form";
      form.method = "POST";
      form.action = "https://example.com/submit";
      form.addEventListener("submit", (e) => e.preventDefault());
      document.body.appendChild(form);

      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      // queueMicrotask fires before setTimeout, so just flush microtasks
      await vi.advanceTimersByTimeAsync(0);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "form_submit",
        expect.objectContaining({
          form_id: "signup-form",
          form_method: "POST",
        }),
      );

      document.body.removeChild(form);
      teardown();
    });

    it("tags prevented submissions with prevented: true", async () => {
      const teardown = setupAutoTracking(mockClient, formConfig);

      const form = document.createElement("form");
      form.id = "prevented-form";
      form.addEventListener("submit", (e) => e.preventDefault());
      document.body.appendChild(form);

      const submitEvent = new SubmitEvent("submit", { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
      // The app handler calls preventDefault before queueMicrotask fires
      await vi.advanceTimersByTimeAsync(0);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "form_submit",
        expect.objectContaining({
          prevented: true,
        }),
      );

      document.body.removeChild(form);
      teardown();
    });

    it("does NOT include prevented property on normal (non-prevented) form submit", async () => {
      const teardown = setupAutoTracking(mockClient, formConfig);

      const form = document.createElement("form");
      form.id = "normal-submit-form";
      // No preventDefault handler attached
      document.body.appendChild(form);

      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);

      const call = (mockClient.trackInternal as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[0]).toBe("form_submit");
      const props = call?.[1] as Record<string, unknown>;
      expect(props).not.toHaveProperty("prevented");

      document.body.removeChild(form);
      teardown();
    });

    it("debounces rapid submissions on the same form within 500ms", async () => {
      const teardown = setupAutoTracking(mockClient, formConfig);

      const form = document.createElement("form");
      form.id = "rapid-form";
      form.addEventListener("submit", (e) => e.preventDefault());
      document.body.appendChild(form);

      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);

      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);

      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

      document.body.removeChild(form);
      teardown();
    });
  });

  describe("error tracking", () => {
    const errorConfig: AutoTrackConfig = {
      pageView: false,
      session: false,
      click: false,
      formSubmit: false,
      error: true,
    };

    it("fires error event on window error with stack trace and fingerprint", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      const testError = new Error("Test error");
      testError.stack = "Error: Test error\n    at test.js:42:10\n    at Object.<anonymous> (test.js:1:1)";
      const errorEvent = new ErrorEvent("error", {
        message: "Test error",
        filename: "test.js",
        lineno: 42,
        colno: 10,
        error: testError,
      });
      window.dispatchEvent(errorEvent);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          message: "Test error",
          filename: "test.js",
          lineno: 42,
          colno: 10,
          stack: expect.stringContaining("Error: Test error"),
          error_type: "runtime",
          fingerprint: expect.stringMatching(/^err_/),
        }),
      );

      teardown();
    });

    it("fires error event on unhandledrejection with stack and fingerprint", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      const rejectionEvent = new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: new Error("Async failure"),
      });
      window.dispatchEvent(rejectionEvent);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          message: "Async failure",
          type: "unhandledrejection",
          error_type: "promise",
          fingerprint: expect.stringMatching(/^err_/),
        }),
      );

      teardown();
    });

    it("fires error event on unhandledrejection with string reason", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      const rejectionEvent = new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: "string rejection",
      });
      window.dispatchEvent(rejectionEvent);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          message: "string rejection",
          type: "unhandledrejection",
          error_type: "promise",
          fingerprint: expect.stringMatching(/^err_/),
        }),
      );

      teardown();
    });

    it("handles unknown rejection reason gracefully", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      const rejectionEvent = new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: 12345,
      });
      window.dispatchEvent(rejectionEvent);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          message: "Unhandled promise rejection: 12345",
          type: "unhandledrejection",
          error_type: "promise",
        }),
      );

      teardown();
    });

    it("captures error message with fallback for missing fields", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      const errorEvent = new ErrorEvent("error", {});
      window.dispatchEvent(errorEvent);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          message: expect.any(String),
          error_type: "runtime",
          fingerprint: expect.stringMatching(/^err_/),
        }),
      );

      teardown();
    });

    it("truncates stack traces to 1024 characters", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      const testError = new Error("Big error");
      testError.stack = "Error: Big error\n" + "    at some.long.function.name (very/long/path/to/file.js:1:1)\n".repeat(100);
      const errorEvent = new ErrorEvent("error", {
        message: "Big error",
        filename: "file.js",
        lineno: 1,
        error: testError,
      });
      window.dispatchEvent(errorEvent);

      const call = (mockClient.trackInternal as ReturnType<typeof vi.fn>).mock.calls[0];
      const props = call[1] as Record<string, unknown>;
      expect((props.stack as string).length).toBeLessThanOrEqual(1024);
      expect((props.stack as string).endsWith("…")).toBe(true);

      teardown();
    });

    it("sets null stack when error object has no stack", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      const errorEvent = new ErrorEvent("error", {
        message: "No stack error",
        filename: "test.js",
        lineno: 1,
      });
      window.dispatchEvent(errorEvent);

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          stack: null,
          error_type: "runtime",
        }),
      );

      teardown();
    });

    it("generates same fingerprint for identical errors", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      for (let i = 0; i < 2; i++) {
        const errorEvent = new ErrorEvent("error", {
          message: "Same error",
          filename: "same.js",
          lineno: 10,
        });
        window.dispatchEvent(errorEvent);
      }

      const calls = (mockClient.trackInternal as ReturnType<typeof vi.fn>).mock.calls;
      const fp1 = (calls[0][1] as Record<string, unknown>).fingerprint;
      const fp2 = (calls[1][1] as Record<string, unknown>).fingerprint;
      expect(fp1).toBe(fp2);

      teardown();
    });

    it("generates different fingerprints for different errors", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      window.dispatchEvent(new ErrorEvent("error", {
        message: "Error A",
        filename: "a.js",
        lineno: 1,
      }));
      window.dispatchEvent(new ErrorEvent("error", {
        message: "Error B",
        filename: "b.js",
        lineno: 2,
      }));

      const calls = (mockClient.trackInternal as ReturnType<typeof vi.fn>).mock.calls;
      const fp1 = (calls[0][1] as Record<string, unknown>).fingerprint;
      const fp2 = (calls[1][1] as Record<string, unknown>).fingerprint;
      expect(fp1).not.toBe(fp2);

      teardown();
    });

    it("ignores Chrome extension errors", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      window.dispatchEvent(new ErrorEvent("error", {
        message: "Uncaught TypeError: Cannot read properties of undefined",
        filename: "chrome-extension://opfgelmcmbiajamepnmloijbpoleiama/inpage.js",
        lineno: 1,
      }));

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      teardown();
    });

    it("ignores Firefox extension errors", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      window.dispatchEvent(new ErrorEvent("error", {
        message: "some error",
        filename: "moz-extension://abc-123/content.js",
      }));

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      teardown();
    });

    it("ignores cross-origin 'Script error.' with no filename", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      window.dispatchEvent(new ErrorEvent("error", {
        message: "Script error.",
      }));

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      teardown();
    });

    it("tracks real app errors normally", () => {
      const teardown = setupAutoTracking(mockClient, errorConfig);

      window.dispatchEvent(new ErrorEvent("error", {
        message: "TypeError: Cannot read property 'foo' of null",
        filename: "https://myapp.com/bundle.js",
        lineno: 42,
      }));

      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          message: "TypeError: Cannot read property 'foo' of null",
          filename: "https://myapp.com/bundle.js",
        }),
      );
      teardown();
    });
  });

  describe("teardown", () => {
    it("removes all listeners when teardown is called", () => {
      const allConfig: AutoTrackConfig = {
        pageView: true,
        session: false,
        click: true,
        formSubmit: true,
        error: true,
      };
      const teardown = setupAutoTracking(mockClient, allConfig);
      (mockClient.trackInternal as ReturnType<typeof vi.fn>).mockClear();

      teardown();

      // Page views should no longer track
      history.pushState({}, "", "/after-teardown-all");
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalledWith(
        "page_view",
        expect.anything(),
      );

      // Clicks should no longer track
      const button = document.createElement("button");
      document.body.appendChild(button);
      button.click();
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalledWith(
        "click",
        expect.anything(),
      );
      document.body.removeChild(button);

      // Errors should no longer track
      window.dispatchEvent(
        new ErrorEvent("error", { message: "After teardown" }),
      );
      expect((mockClient.trackInternal as ReturnType<typeof vi.fn>)).not.toHaveBeenCalledWith(
        "error",
        expect.anything(),
      );
    });
  });
});
