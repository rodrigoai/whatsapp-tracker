"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/Providers";

type Account = {
  id: string;
  name: string;
};

export default function AdminDashboard() {
  const { selectedAccountId, setAccount } = useAccount();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounts");
    if (res.ok) {
      const data = (await res.json()) as Account[];
      setAccounts(data);
      if (!selectedAccountId && data.length > 0) {
        setAccount(data[0].id);
      }
    }
    setLoading(false);
  }, [selectedAccountId, setAccount]);

  useEffect(() => {
    void Promise.resolve().then(fetchAccounts);
  }, [fetchAccounts]);

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName) return;
    const res = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAccountName }),
    });
    if (res.ok) {
      setNewAccountName("");
      fetchAccounts();
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm("Are you sure? This deletes everything related to this account.")) return;
    const res = await fetch(`/api/admin/accounts?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (selectedAccountId === id) setAccount(null);
      fetchAccounts();
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Accounts Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage the websites where the tracking script is installed.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Create Account</h2>
          <form onSubmit={createAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website / Account Name</label>
              <input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="My Store Website"
              />
            </div>
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Add Account
            </button>
          </form>
        </div>

        <div className="md:col-span-2">
          {loading ? (
            <div className="text-center p-8 text-slate-500">Loading accounts...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accounts.map(account => (
                <div 
                  key={account.id} 
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group ${
                    selectedAccountId === account.id 
                      ? "border-purple-500 bg-purple-50" 
                      : "border-transparent bg-white hover:border-slate-300 shadow-sm"
                  }`}
                  onClick={() => setAccount(account.id)}
                >
                  {selectedAccountId === account.id && (
                    <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">
                      Selected
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{account.name}</h3>
                  <div className="text-sm text-slate-500 mb-4 font-mono text-xs truncate">ID: {account.id}</div>
                  
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteAccount(account.id); }}
                      className="text-red-500 hover:text-red-700 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                    {selectedAccountId !== account.id && (
                      <span className="text-purple-600 text-sm font-medium">Select &rarr;</span>
                    )}
                  </div>
                </div>
              ))}
              {accounts.length === 0 && (
                <div className="col-span-full text-center p-8 bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500">
                  No accounts found. Create one to get started.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
