/**
 * Anonymous session management.
 * UUID stored in localStorage + cookie backup (Safari ITP mitigation).
 */

import { useState } from 'react';

const SESSION_KEY = 'gate_session_id';
const COOKIE_KEY = 'gate_sid';

function generateUUID(): string {
  return crypto.randomUUID();
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getOrCreateSession(): string {
  // Try localStorage first
  let id = localStorage.getItem(SESSION_KEY);
  if (id) {
    setCookie(COOKIE_KEY, id, 365); // Keep cookie in sync
    return id;
  }

  // Try cookie fallback (Safari ITP clears localStorage after 7 days)
  id = getCookie(COOKIE_KEY);
  if (id) {
    localStorage.setItem(SESSION_KEY, id);
    return id;
  }

  // Generate new session
  id = generateUUID();
  localStorage.setItem(SESSION_KEY, id);
  setCookie(COOKIE_KEY, id, 365);
  return id;
}

export function useSession() {
  const [sessionId] = useState(getOrCreateSession);
  return sessionId;
}
