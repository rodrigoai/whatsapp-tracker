"use client";
import { useCallback, useEffect, useState } from "react";
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
};

export default function ConfigPage() {
  const { selectedAccountId } = useAccount();
  const [config, setConfig] = useState<ButtonConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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
    await fetch(`/api/admin/config?accountId=${selectedAccountId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
  };

  const copyScript = () => {
    const script = `<script src="${window.location.origin}/api/script.js?accountId=${selectedAccountId}"></script>`;
    navigator.clipboard.writeText(script);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!selectedAccountId) {
    return <div className="p-8 text-center text-slate-500">Please select an account from the dashboard first.</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Button Configuration</h1>
          <p className="text-slate-500 mt-1">Customize the WhatsApp float button for this account.</p>
        </div>
        <button
          onClick={copyScript}
          className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {copySuccess ? "Copied!" : "Copy Script Tag"}
        </button>
      </header>

      {loading || !config ? (
        <div className="text-center p-8">Loading...</div>
      ) : (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 text-sm text-slate-700">
            <h2 className="text-base font-semibold text-slate-900">Tracking events</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-medium text-slate-800">Google Analytics</p>
                <p className="mt-1">
                  After a form submission is accepted, the widget sends the configured GA event name with the WhatsApp category, account ID, and attendant name. It uses <code className="rounded bg-white/70 px-1 py-0.5">gtag</code> when available and falls back to <code className="rounded bg-white/70 px-1 py-0.5">dataLayer</code>.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-800">Meta Pixel</p>
                <p className="mt-1">
                  The host page must already have Meta Pixel installed. The widget sends <code className="rounded bg-white/70 px-1 py-0.5">Contact</code> when someone opens the WhatsApp button and <code className="rounded bg-white/70 px-1 py-0.5">Lead</code> after the form is successfully submitted.
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
              <select
                value={config.position}
                onChange={(e) => setConfig({ ...config, position: e.target.value as "LEFT" | "RIGHT" })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="RIGHT">Bottom Right</option>
                <option value="LEFT">Bottom Left</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
              <select
                value={config.size}
                onChange={(e) => setConfig({ ...config, size: e.target.value as "SMALL" | "LARGE" })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="LARGE">Large (48px)</option>
                <option value="SMALL">Small (36px)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Color</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Button Text</label>
              <input
                type="text"
                value={config.buttonText}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Balloon Text</label>
              <textarea
                value={config.balloonText}
                onChange={(e) => setConfig({ ...config, balloonText: e.target.value })}
                rows={3}
                maxLength={240}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GCLID Expiration (Days)</label>
              <input
                type="number"
                min="1"
                value={config.gclidExpirationDays}
                onChange={(e) => setConfig({ ...config, gclidExpirationDays: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conversion Name (Export Data)</label>
              <input
                type="text"
                value={config.conversionName}
                onChange={(e) => setConfig({ ...config, conversionName: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Google Analytics Event Name</label>
              <input
                type="text"
                value={config.gaEventName}
                onChange={(e) => setConfig({ ...config, gaEventName: e.target.value })}
                pattern="[A-Za-z][A-Za-z0-9_]{0,79}"
                title="Use letters, numbers, and underscores. Start with a letter."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="whatsapp_form_submit"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Allowed Origins</label>
              <input
                type="text"
                value={config.allowedOrigins}
                onChange={(e) => setConfig({ ...config, allowedOrigins: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="https://example.com, https://store.example.com or *"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-8 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
