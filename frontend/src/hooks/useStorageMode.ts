/**
 * useStorageMode — controls whether GBrain uses the server DB or client IndexedDB.
 *
 * Precedence:
 *   1. localStorage override ('gbrain_storage_mode') — user/dev toggle
 *   2. VITE_STORAGE_MODE build-time env
 *   3. 'auto' → IndexedDB if at least one material is uploaded, else DB
 *
 * Exposes:
 *   mode: 'postgres' | 'indexeddb' | 'auto'
 *   effectiveMode: resolved mode ('postgres' | 'indexeddb')
 *   setMode: persist override
 *   groundingCount: number of uploaded material chunks available (IndexedDB only)
 */

import { useState, useEffect, useCallback } from 'react';
import { getAllMaterialEmbeddings } from '@/lib/gbrain/db';

export type StorageMode = 'postgres' | 'indexeddb' | 'auto';

const STORAGE_KEY = 'gbrain_storage_mode';

function resolveMode(mode: StorageMode, hasMaterials: boolean): 'postgres' | 'indexeddb' {
  if (mode === 'postgres') return 'postgres';
  if (mode === 'indexeddb') return 'indexeddb';
  return hasMaterials ? 'indexeddb' : 'postgres';
}

function loadInitialMode(): StorageMode {
  try {
    const override = localStorage.getItem(STORAGE_KEY);
    if (override === 'postgres' || override === 'indexeddb' || override === 'auto') return override;
  } catch { /* SSR or blocked */ }
  const envMode = (import.meta as any).env?.VITE_STORAGE_MODE as string | undefined;
  if (envMode === 'postgres' || envMode === 'indexeddb' || envMode === 'auto') return envMode;
  return 'auto';
}

export function useStorageMode() {
  const [mode, setModeState] = useState<StorageMode>(loadInitialMode);
  const [groundingCount, setGroundingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAllMaterialEmbeddings()
      .then(e => { if (!cancelled) setGroundingCount(e.length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const setMode = useCallback((next: StorageMode) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* blocked */ }
    setModeState(next);
  }, []);

  const effectiveMode = resolveMode(mode, groundingCount > 0);

  return { mode, effectiveMode, setMode, groundingCount };
}
