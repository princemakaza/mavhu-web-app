import { useCbzData } from './CbzDataContext';
import type { CbzStoreState } from './types';

export function useCbz(): CbzStoreState {
  return useCbzData().state;
}
