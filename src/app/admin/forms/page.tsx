"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/Providers";

type FormTracking = {
  id: string;
  name: string;
  selector: string;
  isActive: boolean;
};

type FormsResponse = {
  forms: FormTracking[];
  allowedOrigins: string;
};

export default function FormsPage() {
  const { selectedAccountId } = useAccount();
  const [forms, setForms] = useState<FormTracking[]>([]);
  const [allowedOrigins, setAllowedOrigins] = useState("*");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [name, setName] = useState("");
  const [selector, setSelector] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSelector, setEditingSelector] = useState("");

  const fetchForms = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/forms?accountId=${selectedAccountId}`);
    if (res.ok) {
      const data = (await res.json()) as FormsResponse;
      setForms(data.forms);
      setAllowedOrigins(data.allowedOrigins || "*");
    }
    setLoading(false);
  }, [selectedAccountId]);

  useEffect(() => {
    void Promise.resolve().then(fetchForms);
  }, [fetchForms]);

  const copyScript = () => {
    if (!selectedAccountId) return;
    const script = `<script src="${window.location.origin}/api/forms/script.js?accountId=${selectedAccountId}"></script>`;
    navigator.clipboard.writeText(script);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const addForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !name.trim() || !selector.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selectedAccountId, name, selector, isActive: true }),
    });
    if (res.ok) {
      setName("");
      setSelector("");
      await fetchForms();
    }
    setSaving(false);
  };

  const startEditing = (form: FormTracking) => {
    setEditingId(form.id);
    setEditingName(form.name);
    setEditingSelector(form.selector);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
    setEditingSelector("");
  };

  const updateForm = async (form: FormTracking, values: Partial<FormTracking> = {}) => {
    const next = {
      name: values.name ?? form.name,
      selector: values.selector ?? form.selector,
      isActive: values.isActive ?? form.isActive,
    };

    const res = await fetch(`/api/admin/forms?id=${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    if (res.ok) {
      cancelEditing();
      await fetchForms();
    }
  };

  const deleteForm = async (id: string) => {
    if (!confirm("Excluir este rastreamento de formulário?")) return;
    const res = await fetch(`/api/admin/forms?id=${id}`, { method: "DELETE" });
    if (res.ok) await fetchForms();
  };

  if (!selectedAccountId) {
    return <div className="p-8 text-center text-slate-500">Selecione uma conta primeiro.</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Forms</h1>
          <p className="text-slate-500 mt-1">Configure formulários externos para registrar leads pelo seletor CSS.</p>
        </div>
        <button
          onClick={copyScript}
          className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {copySuccess ? "Copiado!" : "Copiar tag do script"}
        </button>
      </header>

      <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Origens permitidas compartilhadas</h2>
            <p className="mt-1 font-mono text-sm text-slate-600 break-all">{allowedOrigins}</p>
          </div>
          <Link
            href="/admin/config"
            className="text-sm font-medium text-purple-700 hover:text-purple-900"
          >
            Editar em configuração do botão
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Adicionar form</h2>
          <form onSubmit={addForm} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="Form principal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Query selector</label>
              <input
                type="text"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                maxLength={500}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono text-sm"
                placeholder="#form-one"
              />
              <p className="text-xs text-slate-400 mt-1">Use seletores CSS que apontem para elementos form, como #form-one ou form[data-lead].</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Adicionar form"}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-center p-8 text-slate-500">Carregando...</div>
          ) : forms.length === 0 ? (
            <div className="text-center p-8 bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500">
              Nenhum form configurado.
            </div>
          ) : (
            forms.map((form) => {
              const isEditing = editingId === form.id;
              return (
                <div key={form.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
                  {isEditing ? (
                    <div className="grid gap-3 md:grid-cols-[1fr_1.5fr]">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editingSelector}
                        onChange={(e) => setEditingSelector(e.target.value)}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono text-sm"
                      />
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-bold text-slate-800">{form.name}</h3>
                      <p className="text-sm text-slate-500 font-mono break-all">{form.selector}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => updateForm(form, { isActive: !form.isActive })}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${form.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {form.isActive ? "Ativo" : "Inativo"}
                    </button>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => updateForm(form, { name: editingName, selector: editingSelector })}
                          className="text-sm font-medium text-purple-700 hover:text-purple-900"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEditing(form)}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      onClick={() => deleteForm(form.id)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
