import { log } from "./logger";

const ANON_ID_KEY = "infer_anonymous_id";

let anonymousId: string | null = null;
let userId: string | null = null;
let userTraits: Record<string, string | number | boolean | null> = {};

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function getAnonymousId(): string {
  if (anonymousId) return anonymousId;

  const storage = getStorage();
  if (storage) {
    const stored = storage.getItem(ANON_ID_KEY);
    if (stored) {
      anonymousId = stored;
      return anonymousId;
    }
  }

  anonymousId = crypto.randomUUID();
  log("Generated anonymous_id:", anonymousId);

  if (storage) {
    try {
      storage.setItem(ANON_ID_KEY, anonymousId);
    } catch {
      // Storage full or unavailable — continue with in-memory ID
    }
  }

  return anonymousId;
}

export function getUserId(): string | null {
  return userId;
}

export function getUserTraits(): Record<string, string | number | boolean | null> {
  return userTraits;
}

export function setIdentity(
  newUserId: string,
  traits?: Record<string, string | number | boolean | null>,
): void {
  userId = newUserId;
  if (traits) {
    userTraits = { ...userTraits, ...traits };
  }
  log("Identity set:", userId, userTraits);
}

const TAB_ID_KEY = "infer_tab_id";

export function getTabId(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    let id = sessionStorage.getItem(TAB_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(TAB_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function resetIdentity(): void {
  userId = null;
  userTraits = {};
  anonymousId = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(ANON_ID_KEY);
    } catch {
      // Ignore
    }
  }
}
