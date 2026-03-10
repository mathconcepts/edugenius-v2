/**
 * connectionBridge.ts — Runtime credential resolver
 *
 * Priority chain (highest to lowest):
 *   1. User-scoped key  (edugenius_user_connections_${userId})
 *   2. Platform localStorage key (edugenius_connections)
 *   3. Build-time env var (import.meta.env.VITE_*)
 *   4. undefined
 *
 * All services should call getKey() instead of import.meta.env directly.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const PLATFORM_KEY = 'edugenius_connections';

// ─── userId helper ────────────────────────────────────────────────────────────

// Lazy reference to loadCurrentUser — populated after first call, avoids circular deps
let _loadCurrentUser: (() => import('./userService').EGUser | null) | null = null;

async function _initUserLoader(): Promise<void> {
  if (_loadCurrentUser) return;
  try {
    const mod = await import('./userService');
    _loadCurrentUser = mod.loadCurrentUser;
  } catch {
    // ignore
  }
}
// Trigger the async init (fire and forget — it will be ready by the time a user actually calls getKey)
_initUserLoader().catch(() => {});

/** Get the current userId for scoping — never throws, returns 'guest' if user not loaded yet */
function getCurrentUserId(): string {
  try {
    if (_loadCurrentUser) {
      return _loadCurrentUser()?.uid ?? 'guest';
    }
    // Fallback: try reading directly from localStorage without the service
    const raw = localStorage.getItem('edugenius_current_user');
    if (raw) {
      const parsed = JSON.parse(raw) as { uid?: string };
      if (parsed?.uid) return parsed.uid;
    }
    return 'guest';
  } catch {
    return 'guest';
  }
}

// ─── Safe localStorage access ─────────────────────────────────────────────────

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage unavailable (SSR / test environment)
    return null;
  }
}

function safeParse(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

// ─── Public read helpers ──────────────────────────────────────────────────────

/**
 * Get the full platform connections map (edugenius_connections).
 */
export function getPlatformConnections(): Record<string, string> {
  return safeParse(safeGetItem(PLATFORM_KEY));
}

/**
 * Get the full user connections map for the current user.
 */
export function getUserConnections(): Record<string, string> {
  const userId = getCurrentUserId();
  return safeParse(safeGetItem(`edugenius_user_connections_${userId}`));
}

// ─── Core resolver ────────────────────────────────────────────────────────────

/**
 * Resolve a credential from all sources (priority: user > platform > env).
 *
 * @param envKey      The VITE_ env var name, e.g. 'VITE_GEMINI_API_KEY'
 * @param storageKey  The localStorage field key; defaults to envKey if omitted
 */
export function getKey(envKey: string, storageKey?: string): string | undefined {
  const sKey = storageKey ?? envKey;

  // 1. User-scoped key
  const userVal = getUserConnections()[sKey];
  if (userVal) return userVal;

  // 2. Platform localStorage key
  const platformVal = getPlatformConnections()[sKey];
  if (platformVal) return platformVal;

  // 3. Build-time env var
  const env = (import.meta as any).env ?? {};
  const envVal = env[envKey] as string | undefined;
  if (envVal) return envVal;

  return undefined;
}

/**
 * Resolve an exam-scoped key.
 * Check order: `${baseKey}_${EXAMTYPE}` → `${baseKey}` → env
 *
 * @param baseKey   Base storage / env key, e.g. 'WOLFRAM_APP_ID'
 * @param examType  Exam identifier e.g. 'JEE', 'GATE', 'NEET'
 */
export function getExamKey(baseKey: string, examType?: string): string | undefined {
  if (examType) {
    const examSpecificKey = `${baseKey}_${examType.toUpperCase()}`;

    // Check user-scoped exam key first
    const userVal = getUserConnections()[examSpecificKey];
    if (userVal) return userVal;

    // Then platform exam key
    const platformVal = getPlatformConnections()[examSpecificKey];
    if (platformVal) return platformVal;

    // Then env exam key (e.g. VITE_WOLFRAM_APP_ID_JEE)
    const env = (import.meta as any).env ?? {};
    const envExamKey = `VITE_${examSpecificKey}`;
    const envExamVal = env[envExamKey] as string | undefined;
    if (envExamVal) return envExamVal;
  }

  // Fall back to base key (no exam suffix)
  return getKey(`VITE_${baseKey}`, baseKey);
}

// ─── Agent connection helpers ─────────────────────────────────────────────────

/**
 * Get all connections available to a specific agent.
 * Reads from edugenius_agent_connections_${agentId}.
 * Returns { connectionId: boolean } map.
 */
export function getAgentConnections(agentId: string): Record<string, boolean> {
  try {
    const raw = safeGetItem(`edugenius_agent_connections_${agentId}`);
    if (!raw) return {};
    // ConnectionRegistry stores this as a JSON array of IDs
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Object.fromEntries((parsed as string[]).map((id) => [id, true]));
    }
    // If it's already a map format, return as-is
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Check if a connection is enabled for an agent.
 */
export function isConnectionEnabledForAgent(agentId: string, connectionId: string): boolean {
  return !!getAgentConnections(agentId)[connectionId];
}

// ─── Change notifications ─────────────────────────────────────────────────────

/**
 * Watch for connection changes (storage events) and call callback.
 * Returns a cleanup function.
 */
export function onConnectionsChanged(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (
      e.key === PLATFORM_KEY ||
      e.key?.startsWith('edugenius_user_connections_') ||
      e.key?.startsWith('edugenius_agent_connections_')
    ) {
      callback();
    }
  };

  try {
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  } catch {
    // Non-browser environment (SSR / tests)
    return () => {};
  }
}
