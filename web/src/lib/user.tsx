import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

export type SessionUser = { id: string; email: string; firstName: string; lastName: string; role: string; loyaltyPoints?: number };

type Ctx = {
  user: SessionUser | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

const Ctx = createContext<Ctx>({ user: null, loaded: false, refresh: async () => {}, clear: () => {} });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    try {
      const x = await api<{ user: SessionUser | null }>('/auth/me');
      setUser(x.user ?? null);
    } catch { setUser(null); }
    setLoaded(true);
  };

  const clear = () => setUser(null);

  useEffect(() => { refresh(); }, []);

  return <Ctx.Provider value={{ user, loaded, refresh, clear }}>{children}</Ctx.Provider>;
}

export const useUser = () => useContext(Ctx);
