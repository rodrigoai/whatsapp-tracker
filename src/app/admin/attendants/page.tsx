"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/Providers";

type Attendant = {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
};

export default function AttendantsPage() {
  const { selectedAccountId } = useAccount();
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const fetchAttendants = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/attendants?accountId=${selectedAccountId}`);
    if (res.ok) {
      setAttendants((await res.json()) as Attendant[]);
    }
    setLoading(false);
  }, [selectedAccountId]);

  useEffect(() => {
    void Promise.resolve().then(fetchAttendants);
  }, [fetchAttendants]);

  const addAttendant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    const res = await fetch("/api/admin/attendants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selectedAccountId, name, phone }),
    });
    if (res.ok) {
      setName("");
      setPhone("");
      fetchAttendants();
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await fetch(`/api/admin/attendants?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentStatus }),
    });
    fetchAttendants();
  };

  const deleteAttendant = async (id: string) => {
    if (!confirm("Excluir este atendente?")) return;
    await fetch(`/api/admin/attendants?id=${id}`, { method: "DELETE" });
    fetchAttendants();
  };

  if (!selectedAccountId) {
    return <div className="p-8 text-center text-slate-500">Selecione uma conta primeiro.</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-800">Números dos atendentes</h1>
        <p className="text-slate-500 mt-1">Gerencie os números usados no redirecionamento alternado do WhatsApp.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Adicionar atendente</h2>
          <form onSubmit={addAttendant} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="João Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número de telefone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="5511999999999"
              />
              <p className="text-xs text-slate-400 mt-1">Inclua o código do país, como 55 para Brasil. Ele será adicionado automaticamente para números com 10 ou 11 dígitos.</p>
            </div>
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg">
              Adicionar atendente
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {loading ? (
             <div className="text-center p-8 text-slate-500">Carregando...</div>
          ) : attendants.length === 0 ? (
            <div className="text-center p-8 bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500">
              Nenhum atendente encontrado.
            </div>
          ) : (
            attendants.map(attendant => (
              <div key={attendant.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{attendant.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{attendant.phone}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleStatus(attendant.id, attendant.isActive)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${attendant.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {attendant.isActive ? "Ativo" : "Inativo"}
                  </button>
                  <button 
                    onClick={() => deleteAttendant(attendant.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
