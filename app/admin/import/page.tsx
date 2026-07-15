// app/admin/import/page.tsx
"use client";

import { useState } from "react";
import Papa from "papaparse";
import { importNSRTaxonomy } from "@/app/actions/importTaxonomy";

export default function ImportPage() {
  const [taxaData, setTaxaData] = useState<any[] | null>(null);
  const [namesData, setNamesData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCSVUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    setData: (data: any[]) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setData(results.data);
      },
    });
  };

  const handleStartImport = async () => {
    if (!taxaData || !namesData) return;

    setLoading(true);
    setResult(null);
    setProgress("Voorbereiden...");

    const CHUNK_SIZE = 500; // Stuur telkens 500 taxa tegelijk naar de server
    const totalTaxa = taxaData.length;

    // We sturen de complete namen-lijst één keer mee (of filteren deze per chunk om payload klein te houden)
    // Omdat we in kleine stapjes (chunks) importeren, kunnen we door de taxa heen loopen:
    try {
      for (let i = 0; i < totalTaxa; i += CHUNK_SIZE) {
        const chunkTaxa = taxaData.slice(i, i + CHUNK_SIZE);
        
        // Filter alleen de Nederlandse namen die horen bij de taxa in deze chunk
        const chunkTaxonIds = new Set(chunkTaxa.map(t => t.taxonID));
        const chunkNames = namesData.filter(n => chunkTaxonIds.has(n.taxonID));

        setProgress(`Bezig met importeren: ${i} tot ${Math.min(i + CHUNK_SIZE, totalTaxa)} van de ${totalTaxa} soorten...`);

        // Roep Server Action aan voor deze chunk
        const response = await importNSRTaxonomy(chunkTaxa, chunkNames);

        if (!response.success) {
          throw new Error(response.message);
        }
      }

      setResult({ success: true, message: `🎉 Volledige import succesvol afgerond! Alle ${totalTaxa} taxa zijn verwerkt.` });
    } catch (err: any) {
      setResult({ success: false, message: `Fout opgetreden tijdens de batch-import: ${err.message}` });
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8 bg-white rounded-xl shadow-sm border border-slate-200 mt-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Soortenregister Importeur</h1>
        <p className="text-sm text-slate-500 mt-1">Met automatische chunking voor grote bestanden.</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">1. Selecteer `Taxa.csv`</label>
          <input type="file" accept=".csv" onChange={(e) => handleCSVUpload(e, setTaxaData)} className="block w-full text-sm" />
          {taxaData && <p className="text-xs text-green-600 mt-1 font-medium">✓ {taxaData.length} records geladen.</p>}
        </div>

        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">2. Selecteer `Vernacular_Names.csv`</label>
          <input type="file" accept=".csv" onChange={(e) => handleCSVUpload(e, setNamesData)} className="block w-full text-sm" />
          {namesData && <p className="text-xs text-green-600 mt-1 font-medium">✓ {namesData.length} namen geladen.</p>}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <button
          onClick={handleStartImport}
          disabled={loading || !taxaData || !namesData}
          className="w-full text-center py-3 px-4 rounded-lg font-bold text-sm bg-blue-600 text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          {loading ? "Import is gestart..." : "Start Sync Batch-import"}
        </button>
        
        {progress && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-mono animate-pulse">
            ⏳ {progress}
          </div>
        )}
      </div>

      {result && (
        <div className={`p-4 rounded-lg text-sm font-medium ${result.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}