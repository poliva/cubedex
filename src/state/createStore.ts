import { useRef, useSyncExternalStore } from 'react';

export interface Store<T> {
  getState(): T;
  setState(updater: Partial<T> | ((prev: T) => Partial<T> | T)): void;
  subscribe(listener: () => void): () => void;
}

export function shallowEqual<A>(a: A, b: A): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keysA = Object.keys(ao);
  const keysB = Object.keys(bo);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(bo, key)) return false;
    if (!Object.is(ao[key], bo[key])) return false;
  }
  return true;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  function getState(): T {
    return state;
  }

  function setState(updater: Partial<T> | ((prev: T) => Partial<T> | T)): void {
    const next = typeof updater === 'function'
      ? (updater as (prev: T) => Partial<T> | T)(state)
      : updater;
    if (!next) return;
    // Merge if the updater returned a partial, otherwise treat as full replacement.
    const merged = { ...state, ...next } as T;
    if (shallowEqual(state, merged)) return;
    state = merged;
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // ignore
      }
    }
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { getState, setState, subscribe };
}

/**
 * Subscribe to a narrow slice of a store with a custom equality function.
 * Re-renders only when the selected slice changes according to `equals`.
 *
 * The cache must live in a `useRef` so it persists across renders; otherwise
 * `useSyncExternalStore` would see a fresh non-stable snapshot on each call
 * and loop.
 */
export function useStoreSelector<T extends object, S>(
  store: Store<T>,
  selector: (state: T) => S,
  equals: (a: S, b: S) => boolean = Object.is,
): S {
  const cacheRef = useRef<{ state: T; value: S } | null>(null);
  const getSnapshot = (): S => {
    const state = store.getState();
    const cache = cacheRef.current;
    if (cache && cache.state === state) {
      return cache.value;
    }
    const next = selector(state);
    if (cache && equals(cache.value, next)) {
      cacheRef.current = { state, value: cache.value };
      return cache.value;
    }
    cacheRef.current = { state, value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
