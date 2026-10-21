import { useCallback, useEffect, useState } from 'react';
import { apiCreateRegisterItem, apiDeleteRegisterItem, apiUpdateRegisterItem, fetchRegister, fetchRegisterDefs } from './cbz_api';
import type { RegisterDef, RegisterItem } from './types';

let defsCache: Promise<RegisterDef[]> | null = null;

/** Register definitions are static per deployment: fetch once. */
export function useRegisterDefs(): RegisterDef[] {
  const [defs, setDefs] = useState<RegisterDef[]>([]);
  useEffect(() => {
    defsCache ??= fetchRegisterDefs().catch((err) => {
      defsCache = null;
      throw err;
    });
    defsCache.then(setDefs).catch(() => setDefs([]));
  }, []);
  return defs;
}

/** One register's entries for the current bank, with create / update / delete that reload. */
export function useRegister(register: string) {
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchRegister(register));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [register]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async (data: Record<string, unknown>, entityCode?: string | null) => {
    const item = await apiCreateRegisterItem(register, { data, entityCode });
    await reload();
    return item;
  };
  const update = async (id: string, data: Record<string, unknown>, entityCode?: string | null) => {
    const item = await apiUpdateRegisterItem(register, id, { data, entityCode });
    await reload();
    return item;
  };
  const remove = async (id: string) => {
    await apiDeleteRegisterItem(register, id);
    await reload();
  };

  return { items, loading, error, reload, create, update, remove };
}

/** Loads several registers at once (for metrics that read them). */
export function useRegisters(keys: string[]): Partial<Record<string, RegisterItem[]>> {
  const [data, setData] = useState<Partial<Record<string, RegisterItem[]>>>({});
  const joined = keys.join(',');
  useEffect(() => {
    let alive = true;
    Promise.all(joined.split(',').map(async (k) => [k, await fetchRegister(k).catch(() => [])] as const)).then((pairs) => {
      if (alive) setData(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [joined]);
  return data;
}
