export const dynamic = "force-dynamic";
"use client";

import { useState, useEffect } from "react";
import { getCsvMetadata, importSpecimensChunk } from "@/app/actions/importSpecimens";

export default function ImportSpecimensPage() {
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Lees bij het openen van de pagina direct uit hoeveel regels er in het bestand staan
  useEffect(() => {
    async function fetchMeta() {
      const res = await getCsvMetadata();
      if (res.success) {
        setTotalRows(res.totalRows);
      } else {
        setError(res.message || "Fout bij het laden van tmp.csv metadata.");
      }
    }
    fetchMeta();
  }, []);

  const handleStartImport = async () => {
    if (!totalRows) return;

    setLoading(true);
    setResult(null);
    setError(null);

    const CHUNK_SIZE = 100; // 100 regels per batch om SQLite niet te overbelasten

    try {
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        setProgress(`Bezig met importeren: regel ${i} tot ${Math.min(i + CHUNK_SIZE, totalRows)} van de ${totalRows}...`);
        
        const response = await importSpecimensChunk(i, CHUNK_SIZE);

        if (!response.success) {
          throw new Error(response.message || "Onbekende fout tijdens verwerken batch.");
        }
      }

      setResult({ 
        success: true, 
        message: `🎉 Volledige import succesvol afgerond! Alle ${totalRows} regels uit tmp.csv zijn verwerkt.` 
      });
    } catch (err: any) {
      setError(`Fout opgetreden tijdens de import: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8 bg-white rounded-xl shadow-sm border border-slate-200 mt-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Museum Specimen Importeur</h1>
        <p className="text-sm text-slate-500 mt-1">
          Importeert de kevers en insectendozen vanuit <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-xs">src/tmp.csv</code>.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="p-5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
        <h3 className="font-semibold text-slate-800 text-sm">Status van bronbestand:</h3>
        {totalRows !== null ? (
          <p className="text-sm text-green-700 font-medium">
            ✓ <code className="font-mono">src/tmp.csv</code> is gevonden en bevat <strong>{totalRows}</strong> records om te importeren.
          </p>
        ) : (
          <p className="text-sm text-slate-500 animate-pulse">Bestand controleren op server...</p>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <button
          onClick={handleStartImport}
          disabled={loading || totalRows === null}
          className="w-full text-center py-3 px-4 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:bg-slate-200 disabled:text-slate-400"
        >
          {loading ? "Import is bezig..." : "Start Import vanuit tmp.csv"}
        </button>
        
        {progress && (
          <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono animate-pulse">
            ⏳ {progress}
          </div>
        )}
      </div>

      {result && (
        <div className="p-4 rounded-lg text-sm font-medium bg-green-50 text-green-800 border border-green-200">
          {result.message}
        </div>
      )}
    </div>
  );
}