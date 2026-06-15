"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/components/Providers";

type ButtonConfig = {
  position: "LEFT" | "RIGHT";
  size: "SMALL" | "LARGE";
  primaryColor: string;
  buttonText: string;
  balloonText: string;
  allowedOrigins: string;
  gclidExpirationDays: number | string;
  conversionName: string;
  gaEventName: string;
  formFields: string;
  googleAdsCustomerId: string | null;
  hasGoogleAdsRefreshToken: boolean;
};


const FORM_FIELD_OPTIONS = [
  { value: "name", label: "Nome" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
] as const;

function ConfigPageContent() {
  const { selectedAccountId } = useAccount();
  const [config, setConfig] = useState<ButtonConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected") === "1";
  const oauthError = searchParams.get("oauth_error");

  const fetchConfig = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/config?accountId=${selectedAccountId}`);
    if (res.ok) {
      const data = (await res.json()) as ButtonConfig;
      setConfig({
        ...data,
        allowedOrigins: data.allowedOrigins || "*",
        balloonText: data.balloonText || "Olá! Preencha seus dados para iniciarmos seu atendimento pelo WhatsApp.",
        gaEventName: data.gaEventName || "whatsapp_form_submit",
        formFields: data.formFields || "name,email,phone",
      });
    }
    setLoading(false);
  }, [selectedAccountId]);

  useEffect(() => {
    void Promise.resolve().then(fetchConfig);
  }, [fetchConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/config?accountId=${selectedAccountId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config }),
    });
    if (res.ok) {
      const updated = (await res.json()) as ButtonConfig;
      setConfig(updated);
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!selectedAccountId) return;
    setDisconnecting(true);
    const res = await fetch("/api/admin/google-ads/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selectedAccountId }),
    });
    if (res.ok) {
      const updated = (await res.json()) as ButtonConfig;
      setConfig(prev => prev ? { ...prev, hasGoogleAdsRefreshToken: updated.hasGoogleAdsRefreshToken } : prev);
    }
    setDisconnecting(false);
  };

  const copyScript = () => {
    const script = `<script src="${window.location.origin}/api/script.js?accountId=${selectedAccountId}"></script>`;
    navigator.clipboard.writeText(script);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!selectedAccountId) {
    return <div className="p-8 text-center text-slate-500">Selecione uma conta no painel primeiro.</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Configuração do botão</h1>
          <p className="text-slate-500 mt-1">Personalize o botão flutuante do WhatsApp para esta conta.</p>
        </div>
        <button
          onClick={copyScript}
          className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {copySuccess ? "Copiado!" : "Copiar tag do script"}
        </button>
      </header>

      {justConnected && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-5 py-3 text-sm font-medium">
          Conta Google Ads conectada com sucesso.
        </div>
      )}
      {oauthError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-3 text-sm font-medium">
          Falha ao conectar Google Ads: {oauthError}
        </div>
      )}

      {loading || !config ? (
        <div className="text-center p-8">Carregando...</div>
      ) : (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 text-sm text-slate-700">
            <h2 className="text-base font-semibold text-slate-900">Eventos de rastreamento</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-medium text-slate-800">Google Analytics</p>
                <p className="mt-1">
                  Depois que um envio de formulário é aceito, o widget dispara o evento configurado do GA com a categoria WhatsApp, o ID da conta e o nome do atendente. Ele usa <code className="rounded bg-white/70 px-1 py-0.5">gtag</code> quando disponível e, como alternativa, envia para <code className="rounded bg-white/70 px-1 py-0.5">dataLayer</code>.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-800">Meta Pixel</p>
                <p className="mt-1">
                  A página onde o script está instalado já precisa ter o Meta Pixel configurado. O widget dispara <code className="rounded bg-white/70 px-1 py-0.5">Contact</code> quando alguém abre o botão do WhatsApp e <code className="rounded bg-white/70 px-1 py-0.5">Lead</code> depois que o formulário é enviado com sucesso.
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Posição</label>
              <select
                value={config.position}
                onChange={(e) => setConfig({ ...config, position: e.target.value as "LEFT" | "RIGHT" })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="RIGHT">Inferior direita</option>
                <option value="LEFT">Inferior esquerda</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tamanho</label>
              <select
                value={config.size}
                onChange={(e) => setConfig({ ...config, size: e.target.value as "SMALL" | "LARGE" })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="LARGE">Grande (48px)</option>
                <option value="SMALL">Pequeno (36px)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cor principal</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="h-10 w-10 rounded cursor-pointer border-0 p-0"
                />
                <input
                  type="text"
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Texto do botão</label>
              <input
                type="text"
                value={config.buttonText}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <fieldset className="md:col-span-2">
              <legend className="block text-sm font-medium text-slate-700 mb-2">Campos do formulário</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {FORM_FIELD_OPTIONS.map((field) => {
                  const selectedFields = config.formFields.split(",").filter(Boolean);
                  const isChecked = selectedFields.includes(field.value);
                  return (
                    <label key={field.value} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isChecked && selectedFields.length === 1}
                        onChange={(e) => {
                          const nextFields = e.target.checked
                            ? [...selectedFields, field.value]
                            : selectedFields.filter((value) => value !== field.value);
                          const orderedFields = FORM_FIELD_OPTIONS
                            .map((option) => option.value)
                            .filter((value) => nextFields.includes(value));
                          setConfig({ ...config, formFields: orderedFields.join(",") });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      {field.label}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">Escolha quais campos aparecem no formulário de lead do WhatsApp. Os três vêm habilitados por padrão.</p>
            </fieldset>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Texto do balão</label>
              <textarea
                value={config.balloonText}
                onChange={(e) => setConfig({ ...config, balloonText: e.target.value })}
                rows={3}
                maxLength={240}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiração do GCLID (dias)</label>
              <input
                type="number"
                min="1"
                value={config.gclidExpirationDays}
                onChange={(e) => setConfig({ ...config, gclidExpirationDays: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da conversão (dados de exportação)</label>
              <input
                type="text"
                value={config.conversionName}
                onChange={(e) => setConfig({ ...config, conversionName: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do evento no Google Analytics</label>
              <input
                type="text"
                value={config.gaEventName}
                onChange={(e) => setConfig({ ...config, gaEventName: e.target.value })}
                pattern="[A-Za-z][A-Za-z0-9_]{0,79}"
                title="Use letras, números e sublinhados. Comece com uma letra."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="whatsapp_form_submit"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Origens permitidas</label>
              <input
                type="text"
                value={config.allowedOrigins}
                onChange={(e) => setConfig({ ...config, allowedOrigins: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="https://exemplo.com, https://loja.exemplo.com ou *"
              />
            </div>
          </div>

          <section className="md:col-span-2 rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Google Ads</h2>
              {config.hasGoogleAdsRefreshToken && config.googleAdsCustomerId ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Configurado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                  Não configurado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Conecte sua conta Google Ads para enriquecimento automático de leads com dados de campanha via GCLID.
            </p>
            {config.googleAdsCustomerId && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Conta conectada</p>
                <p className="font-mono text-sm text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                  {config.googleAdsCustomerId}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <a
                href={`/api/admin/google-ads/auth?accountId=${selectedAccountId}`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {config.hasGoogleAdsRefreshToken ? "Reconectar Google Ads" : "Conectar Google Ads"}
              </a>
              {config.hasGoogleAdsRefreshToken && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {disconnecting ? "Desconectando..." : "Desconectar"}
                </button>
              )}
            </div>
          </section>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-8 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ConfigPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando configuração...</div>}>
      <ConfigPageContent />
    </Suspense>
  );
}
