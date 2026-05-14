"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AccountContextType = {
  selectedAccountId: string | null;
  setAccount: (id: string | null) => void;
};

export const AccountContext = createContext<AccountContextType>({
  selectedAccountId: null,
  setAccount: () => {},
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setSelectedAccountId(localStorage.getItem("selectedAccountId"));
    });
  }, []);

  const setAccount = useCallback((id: string | null) => {
    setSelectedAccountId(id);
    if (id) localStorage.setItem("selectedAccountId", id);
    else localStorage.removeItem("selectedAccountId");
  }, []);

  const value = useMemo(
    () => ({ selectedAccountId, setAccount }),
    [selectedAccountId, setAccount]
  );

  return (
    <SessionProvider>
      <AccountContext.Provider value={value}>
        {children}
      </AccountContext.Provider>
    </SessionProvider>
  );
}

export const useAccount = () => useContext(AccountContext);
