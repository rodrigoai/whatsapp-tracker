"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AdsAccount = { id: string; name: string };

type AccountsResponse = {
  configAccountId: string;
  accounts: AdsAccount[];
};

function SelectGoogleAdsAccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") ?? "";

  const [accounts, setAccounts] = useState<AdsAccount[]>([]);
  const [configAccountId, setConfigAccountId] = useState("");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/admin/google-ads/accounts");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Falha ao carregar contas");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as AccountsResponse;
      setConfigAccountId(data.configAccountId);
      setAccounts(data.accounts);
      if (data.accounts.length === 1) setSelected(data.accounts[0].id);
      setLoading(false);
    };
    void load();
  }, []);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/google-ads/select-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: configAccountId || accountId, adsCustomerId: selected }),
    });
    if (res.ok) {
      router.push(`/admin/config?accountId=${configAccountId || accountId}&connected=1`);
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Falha ao salvar conta selecionada");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-500">Carregando contas Google Ads...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800">Selecionar conta Google Ads</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Escolha a conta Google Ads para enriquecer os leads desta conta.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-3 text-sm">
          Nenhuma conta Google Ads acessível encontrada para este usuário Google.
          <div className="mt-3">
            <a
              href={`/admin/config?accountId=${accountId}`}
              className="text-sm font-medium text-amber-700 underline"
            >
              Voltar para configurações
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {accounts.map(account => (
              <li key={account.id}>
                <label className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="adsAccount"
                    value={account.id}
                    checked={selected === account.id}
                    onChange={() => setSelected(account.id)}
                    className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500"
                  />
                  <div>
                    <div className="font-medium text-slate-800">{account.name}</div>
                    <div className="text-xs font-mono text-slate-400">{account.id}</div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
            <a
              href={`/admin/config?accountId=${accountId}`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </a>
            <button
              onClick={() => void handleConfirm()}
              disabled={!selected || saving}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SelectGoogleAdsAccountPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando contas Google Ads...</div>}>
      <SelectGoogleAdsAccountPageContent />
    </Suspense>
  );
}
