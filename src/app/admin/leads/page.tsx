"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/Providers";
import { csvCell } from "@/lib/validation";

type Lead = {
  id: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  conversionTime: string;
  value: number;
  currency: string;
  status: string | null;
  conversionName: string;
};

type ImportSummary = {
  total: number;
  updated: number;
  skipped: number;
};

const STATUS_FILTER_OPTIONS = [
  { value: "Not Qualified", label: "Não qualificado" },
  { value: "Proposta", label: "Proposta" },
  { value: "Venda", label: "Venda" },
];

export default function LeadsPage() {
  const { selectedAccountId } = useAccount();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estado de busca e filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(["Not Qualified", "Proposta", "Venda"]);
  
  // Estado de importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<"Proposta" | "Venda">("Proposta");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/leads?accountId=${selectedAccountId}`);
    if (res.ok) {
      setLeads((await res.json()) as Lead[]);
    }
    setLoading(false);
  }, [selectedAccountId]);

  useEffect(() => {
    void Promise.resolve().then(fetchLeads);
  }, [fetchLeads]);

  const filteredLeads = leads.filter(lead => {
    const name = lead.name ?? "";
    const email = lead.email ?? "";
    const phone = lead.phone ?? "";
    const matchesSearch = 
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm);
    
    const leadStatus = lead.status || "Not Qualified";
    const matchesStatus = statusFilter.includes(leadStatus);
    
    return matchesSearch && matchesStatus;
  });

  const exportCSV = () => {
    const headers = [
      "Google Click ID (GCLID)",
      "GBRAID",
      "WBRAID",
      "Nome da conversão",
      "Horário da conversão",
      "Valor da conversão",
      "Moeda da conversão",
      "Status",
      "Nome",
      "Email",
      "Telefone",
      "Origem UTM",
      "Mídia UTM",
      "Campanha UTM"
    ];
    
    const rows = filteredLeads.map(lead => [
      lead.gclid || "",
      lead.gbraid || "",
      lead.wbraid || "",
      lead.conversionName || "",
      new Date(lead.conversionTime).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00', // Format: AAAA-MM-DD HH:MM:SS-03:00
      lead.value.toFixed(2),
      lead.currency || "BRL",
      lead.status || "Não qualificado",
      lead.name || "",
      lead.email || "",
      lead.phone || "",
      lead.utm_source || "",
      lead.utm_medium || "",
      lead.utm_campaign || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(csvCell).join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "exportacao_conversoes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedAccountId) return;

    setImporting(true);
    setImportSummary(null);
    
    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("status", importStatus);
    formData.append("accountId", selectedAccountId);

    try {
      const res = await fetch("/api/admin/import-results", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImportSummary(data.summary);
        fetchLeads();
      } else {
        alert("Falha ao importar os resultados.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar o arquivo.");
    } finally {
      setImporting(false);
    }
  };

  if (!selectedAccountId) {
    return <div className="p-8 text-center text-slate-500">Selecione uma conta primeiro.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Registro de conversões</h1>
          <p className="text-slate-500 mt-1">Veja e exporte todos os leads capturados para esta conta.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Importar resultados
          </button>
          <button 
            onClick={exportCSV}
            disabled={filteredLeads.length === 0}
            className="bg-green-100 text-green-700 hover:bg-green-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Exportar CSV
          </button>
        </div>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none w-full"
          />
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-lg">
            <span className="text-xs font-semibold text-slate-500 px-2 uppercase">Filtrar status:</span>
            {STATUS_FILTER_OPTIONS.map(status => (
              <label key={status.value} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={statusFilter.includes(status.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setStatusFilter([...statusFilter, status.value]);
                    } else {
                      setStatusFilter(statusFilter.filter(s => s !== status.value));
                    }
                  }}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{status.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3 rounded-tl-lg">Cliente</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Detalhes da conversão</th>
                <th className="px-6 py-3 rounded-tr-lg">UTM / Rastreamento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando leads...</td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum lead encontrado.</td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{lead.name || "Sem nome"}</div>
                      <div className="text-xs text-slate-500">{new Date(lead.conversionTime).toLocaleString('pt-BR')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{lead.email || "Sem email"}</div>
                      <div className="font-mono text-xs">{lead.phone || "Sem telefone"}</div>
                    </td>
                    <td className="px-6 py-4">
                      {lead.status ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          lead.status === 'Venda' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {lead.status}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Não qualificado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">{lead.conversionName}</div>
                      <div className="text-xs text-slate-500">{lead.currency} {lead.value.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono bg-slate-100 p-1 rounded truncate max-w-[150px] mb-1" title={lead.gclid ?? undefined}>
                        {lead.gclid ? `GCLID: ${lead.gclid}` : lead.gbraid ? `GBRAID: ${lead.gbraid}` : lead.wbraid ? `WBRAID: ${lead.wbraid}` : 'Sem ID de clique'}
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

      {/* Modal de importação */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Importar resultados de qualificação</h2>
              <button onClick={() => {
                setIsImportModalOpen(false);
                setImportSummary(null);
              }} className="text-slate-400 hover:text-slate-600 font-bold text-2xl">&times;</button>
            </div>

            {importSummary ? (
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <p className="text-green-800 font-medium">Importação concluída com sucesso!</p>
                  <ul className="mt-2 text-sm text-green-700 space-y-1">
                    <li>Total de registros no arquivo: {importSummary.total}</li>
                    <li>Leads atualizados: {importSummary.updated}</li>
                    <li>Ignorados (sem correspondência): {importSummary.skipped}</li>
                  </ul>
                </div>
                <button 
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportSummary(null);
                  }}
                  className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleImport} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Status de destino</label>
                  <select 
                    value={importStatus}
                    onChange={(e) => setImportStatus(e.target.value as "Proposta" | "Venda")}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="Proposta">Proposta</option>
                    <option value="Venda">Venda</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Selecionar arquivo (.xls, .csv)</label>
                  <input 
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    required
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={importing || !importFile}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {importing ? "Importando..." : "Iniciar importação"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
