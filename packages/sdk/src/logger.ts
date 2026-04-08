let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function log(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.log(`[infer] ${message}`, ...args);
  }
}

export function warn(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.warn(`[infer] ${message}`, ...args);
  }
}

export function error(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.error(`[infer] ${message}`, ...args);
  }
}
