"use client";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/Providers";

export default function LeadsPage() {
  const { selectedAccountId } = useAccount();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (selectedAccountId) fetchLeads();
  }, [selectedAccountId]);

  const fetchLeads = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/leads?accountId=${selectedAccountId}`);
    if (res.ok) {
      setLeads(await res.json());
    }
    setLoading(false);
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone.includes(searchTerm)
  );

  const exportCSV = () => {
    const headers = [
      "Google Click ID (GCLID)",
      "Conversion Name",
      "Conversion Time",
      "Conversion Value",
      "Conversion Currency",
      "Name",
      "Email",
      "Phone",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign"
    ];
    
    const rows = filteredLeads.map(lead => [
      lead.gclid || "",
      lead.conversionName || "",
      new Date(lead.conversionTime).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00', // Format: AAAA-MM-DD HH:MM:SS-03:00
      parseFloat(lead.value).toFixed(2),
      lead.currency || "BRL",
      lead.name,
      lead.email,
      lead.phone,
      lead.utm_source || "",
      lead.utm_medium || "",
      lead.utm_campaign || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "conversions_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedAccountId) {
    return <div className="p-8 text-center text-slate-500">Please select an account first.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Conversion Register</h1>
          <p className="text-slate-500 mt-1">View and export all captured leads for this account.</p>
        </div>
        <button 
          onClick={exportCSV}
          disabled={filteredLeads.length === 0}
          className="bg-green-100 text-green-700 hover:bg-green-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Export to CSV
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3 rounded-tl-lg">Customer</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Conversion Details</th>
                <th className="px-6 py-3 rounded-tr-lg">UTM / Tracking</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading leads...</td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No leads found.</td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{lead.name}</div>
                      <div className="text-xs text-slate-500">{new Date(lead.conversionTime).toLocaleString('pt-BR')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{lead.email}</div>
                      <div className="font-mono text-xs">{lead.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">{lead.conversionName}</div>
                      <div className="text-xs text-slate-500">{lead.currency} {parseFloat(lead.value).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono bg-slate-100 p-1 rounded truncate max-w-[150px] mb-1" title={lead.gclid}>
                        {lead.gclid ? `GCLID: ${lead.gclid}` : 'No GCLID'}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {lead.utm_source && `src: ${lead.utm_source} `}
                        {lead.utm_medium && `med: ${lead.utm_medium} `}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
