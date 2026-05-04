"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, useContext, useState, useEffect } from "react";

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
    const saved = localStorage.getItem("selectedAccountId");
    if (saved) setSelectedAccountId(saved);
  }, []);

  const setAccount = (id: string | null) => {
    setSelectedAccountId(id);
    if (id) localStorage.setItem("selectedAccountId", id);
    else localStorage.removeItem("selectedAccountId");
  };

  return (
    <SessionProvider>
      <AccountContext.Provider value={{ selectedAccountId, setAccount }}>
        {children}
      </AccountContext.Provider>
    </SessionProvider>
  );
}

export const useAccount = () => useContext(AccountContext);
