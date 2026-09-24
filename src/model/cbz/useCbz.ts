import { useSyncExternalStore } from 'react';
import { cbzStore } from './store';
import type { CbzStoreState } from './types';

// React 18+ external-store binding: re-renders anything subscribed whenever a
// mutation calls persist(). Keeps the store fully outside React while the UI
// still enjoys idiomatic hooks.
export function useCbz(): CbzStoreState {
  return useSyncExternalStore(
    (listener) => cbzStore.subscribe(listener),
    () => cbzStore.getState(),
    () => cbzStore.getState(),
  );
}
