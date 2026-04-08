import { describe, it, expect, vi, beforeEach } from "vitest";

// Tips module uses module-level Map state, so we need fresh imports for isolation.
// vi.resetModules() + dynamic import gives us a clean module each time.

async function freshGetTip() {
  vi.resetModules();
  const mod = await import("./tips.js");
  return mod.getTip;
}

describe("getTip", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a tip string for a valid category", async () => {
    const getTip = await freshGetTip();
    const tip = getTip("afterCounts");
    expect(tip).toBeTruthy();
    expect(typeof tip).toBe("string");
    expect(tip.length).toBeGreaterThan(0);
  });

  it("returns tip prefixed with double newline", async () => {
    const getTip = await freshGetTip();
    const tip = getTip("afterCounts");
    expect(tip).toMatch(/^\n\n/);
  });

  it("returns different tips on subsequent calls (rotation)", async () => {
    const getTip = await freshGetTip();
    const tip1 = getTip("afterCounts");
    const tip2 = getTip("afterCounts");
    const tip3 = getTip("afterCounts");
    expect(tip1).not.toBe(tip2);
    expect(tip2).not.toBe(tip3);
  });

  it("returns tips in order (index 0, then 1, then 2...)", async () => {
    const getTip = await freshGetTip();
    const tip1 = getTip("afterRetention");
    // The first tip should contain the first item's content
    expect(tip1).toContain("Track this over time");
  });

  it("resets and starts over after all tips are shown", async () => {
    const getTip = await freshGetTip();

    // afterTopEvents has 4 tips
    const firstRound: string[] = [];
    for (let i = 0; i < 4; i++) {
      firstRound.push(getTip("afterTopEvents"));
    }

    // All 4 should be unique
    const unique = new Set(firstRound);
    expect(unique.size).toBe(4);

    // Next call should reset and return the first tip again
    const afterReset = getTip("afterTopEvents");
    expect(afterReset).toBe(firstRound[0]);
  });

  it("tracks categories independently", async () => {
    const getTip = await freshGetTip();
    const countsTip = getTip("afterCounts");
    const retentionTip = getTip("afterRetention");

    // Both should return their first tips, not share state
    expect(countsTip).toContain("automatically");
    expect(retentionTip).toContain("Track this over time");
  });

  it("works for afterCounts category", async () => {
    const getTip = await freshGetTip();
    const tip = getTip("afterCounts");
    expect(tip).toBeTruthy();
    expect(tip).toContain("💡");
  });

  it("works for afterRetention category", async () => {
    const getTip = await freshGetTip();
    const tip = getTip("afterRetention");
    expect(tip).toBeTruthy();
    expect(tip).toContain("💡");
  });

  it("works for afterJourney category", async () => {
    const getTip = await freshGetTip();
    const tip = getTip("afterJourney");
    expect(tip).toBeTruthy();
    expect(tip).toContain("💡");
  });

  it("works for afterTopEvents category", async () => {
    const getTip = await freshGetTip();
    const tip = getTip("afterTopEvents");
    expect(tip).toBeTruthy();
    expect(tip).toContain("💡");
  });

  it("works for afterInsights category", async () => {
    const getTip = await freshGetTip();
    const tip = getTip("afterInsights");
    expect(tip).toBeTruthy();
    expect(tip).toContain("💡");
  });
});
