"use client";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/Providers";

export default function ConfigPage() {
  const { selectedAccountId } = useAccount();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (selectedAccountId) fetchConfig();
  }, [selectedAccountId]);

  const fetchConfig = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/config?accountId=${selectedAccountId}`);
    if (res.ok) {
      setConfig(await res.json());
    }
    setLoading(false);
  };

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
              <select
                value={config.position}
                onChange={(e) => setConfig({ ...config, position: e.target.value })}
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
                onChange={(e) => setConfig({ ...config, size: e.target.value })}
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
