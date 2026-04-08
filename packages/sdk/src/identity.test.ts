import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAnonymousId", () => {
  it("generates a UUID on first call", async () => {
    const { getAnonymousId } = await import("./identity");
    const id = getAnonymousId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns the same ID on subsequent calls", async () => {
    const { getAnonymousId } = await import("./identity");
    const first = getAnonymousId();
    const second = getAnonymousId();
    expect(first).toBe(second);
  });

  it("persists to localStorage under key 'infer_anonymous_id'", async () => {
    const { getAnonymousId } = await import("./identity");
    const id = getAnonymousId();
    expect(localStorage.getItem("infer_anonymous_id")).toBe(id);
  });

  it("reads from localStorage on first call if exists", async () => {
    localStorage.setItem("infer_anonymous_id", "stored-uuid-123");
    const { getAnonymousId } = await import("./identity");
    const id = getAnonymousId();
    expect(id).toBe("stored-uuid-123");
  });

  it("works without localStorage (returns in-memory ID)", async () => {
    const originalGetItem = localStorage.getItem.bind(localStorage);
    const originalSetItem = localStorage.setItem.bind(localStorage);

    // Simulate localStorage being unavailable
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage unavailable");
    });

    // Need to also mock the typeof check - replace getStorage by making localStorage throw
    // The module tries `typeof localStorage !== "undefined"` then calls methods
    // Since we mock methods to throw, the catch block handles it

    // Actually, getStorage() does try/catch, so we need to make it return null
    // We can do this by making the property access throw
    vi.stubGlobal("localStorage", undefined);

    const { getAnonymousId } = await import("./identity");
    const id = getAnonymousId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Restore
    vi.unstubAllGlobals();
  });
});

describe("setIdentity / getUserId / getUserTraits", () => {
  it("getUserId returns null initially", async () => {
    const { getUserId } = await import("./identity");
    expect(getUserId()).toBeNull();
  });

  it("setIdentity sets userId", async () => {
    const { setIdentity, getUserId } = await import("./identity");
    setIdentity("user-123");
    expect(getUserId()).toBe("user-123");
  });

  it("getUserTraits returns empty object initially", async () => {
    const { getUserTraits } = await import("./identity");
    expect(getUserTraits()).toEqual({});
  });

  it("setIdentity with traits sets them", async () => {
    const { setIdentity, getUserTraits } = await import("./identity");
    setIdentity("user-123", { name: "John", plan: "pro" });
    expect(getUserTraits()).toEqual({ name: "John", plan: "pro" });
  });

  it("multiple setIdentity calls merge traits", async () => {
    const { setIdentity, getUserTraits } = await import("./identity");
    setIdentity("user-123", { name: "John" });
    setIdentity("user-123", { plan: "pro" });
    expect(getUserTraits()).toEqual({ name: "John", plan: "pro" });
  });

  it("setIdentity overwrites userId", async () => {
    const { setIdentity, getUserId } = await import("./identity");
    setIdentity("user-123");
    setIdentity("user-456");
    expect(getUserId()).toBe("user-456");
  });
});

describe("getTabId", () => {
  it("generates a UUID on first call", async () => {
    const { getTabId } = await import("./identity");
    const id = getTabId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("stores in sessionStorage under key 'infer_tab_id'", async () => {
    const { getTabId } = await import("./identity");
    const id = getTabId();
    expect(sessionStorage.getItem("infer_tab_id")).toBe(id);
  });

  it("returns the same ID on subsequent calls", async () => {
    const { getTabId } = await import("./identity");
    const first = getTabId();
    const second = getTabId();
    expect(first).toBe(second);
  });

  it("returns null when sessionStorage is unavailable", async () => {
    vi.stubGlobal("sessionStorage", undefined);
    const { getTabId } = await import("./identity");
    const id = getTabId();
    expect(id).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("resetIdentity", () => {
  it("clears userId, traits, and anonymousId", async () => {
    const { setIdentity, getAnonymousId, getUserId, getUserTraits, resetIdentity } =
      await import("./identity");

    // Set up state
    getAnonymousId();
    setIdentity("user-123", { name: "John" });
    expect(getUserId()).toBe("user-123");
    expect(getUserTraits()).toEqual({ name: "John" });

    resetIdentity();

    expect(getUserId()).toBeNull();
    expect(getUserTraits()).toEqual({});
  });

  it("removes anonymousId from localStorage", async () => {
    const { getAnonymousId, resetIdentity } = await import("./identity");

    getAnonymousId();
    expect(localStorage.getItem("infer_anonymous_id")).toBeTruthy();

    resetIdentity();
    expect(localStorage.getItem("infer_anonymous_id")).toBeNull();
  });

  it("generates a new anonymousId after reset", async () => {
    const { getAnonymousId, resetIdentity } = await import("./identity");

    const firstId = getAnonymousId();
    resetIdentity();
    const secondId = getAnonymousId();
    expect(secondId).not.toBe(firstId);
  });
});
