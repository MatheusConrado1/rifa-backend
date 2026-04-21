import { useSyncExternalStore } from 'react';
import { getState, subscribe } from '../state';

export function useAppState() {
  return useSyncExternalStore(subscribe, getState, getState);
}
