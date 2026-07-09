//app/objecten/RelatieNetwerkForm.tsx
"use client";

import { useRef, useTransition, useState, useEffect } from "react";
import { createObjectRelatieAction, createBulkChildrenAction, searchObjectenAction } from "@/app/actions/objecten";

interface RelatieType { id: string; omschrijving: string; }
interface ObjectType { id: string; omschrijving: string; }

interface Props {
  relatieTypen: RelatieType[];
  objectTypen: ObjectType[];
}

export default function RelatieNetwerkForm({ relatieTypen, objectTypen }: Props) {
  const singleFormRef = useRef<HTMLFormElement>(null);
  const bulkFormRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Geselecteerde ID's voor de database
  const [selectedOuder, setSelectedOuder] = useState("");
  const [selectedKind, setSelectedKind] = useState("");

  // Onafhankelijke zoektermen (Queries)
  const [ouderQuery, setOuderQuery] = useState("");
  const [kindQuery, setKindQuery] = useState("");

  // Dynamische server-side resultatenlijsten
  const [dynamischeOuders, setDynamischeOuders] = useState<any[]>([]);
  const [dynamischeKinderen, setDynamischeKinderen] = useState<any[]>([]);

  const [isSearchingOuder, setIsSearchingOuder] = useState(false);
  const [isSearchingKind, setIsSearchingKind] = useState(false);

  // Debounced zoekactie voor Ouder Objecten
  useEffect(() => {
    if (ouderQuery.trim().length < 2) {
      setDynamischeOuders([]);
      return;
    }
    setIsSearchingOuder(true);
    const delayFn = setTimeout(async () => {
      const resultaten = await searchObjectenAction(ouderQuery);
      setDynamischeOuders(resultaten);
      setIsSearchingOuder(false);
    }, 300);
    return () => clearTimeout(delayFn);
  }, [ouderQuery]);

  // Debounced zoekactie voor Kind Objecten
  useEffect(() => {
    if (kindQuery.trim().length < 2) {
      setDynamischeKinderen([]);
      return;
    }
    setIsSearchingKind(true);
    const delayFn = setTimeout(async () => {
      const resultaten = await searchObjectenAction(kindQuery);
      setDynamischeKinderen(resultaten);
      setIsSearchingKind(false);
    }, 300);
    return () => clearTimeout(delayFn);
  }, [kindQuery]);

  const handleSingleSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await createObjectRelatieAction(formData);
      setFeedback(res);
      if (res.success) {
        singleFormRef.current?.reset();
        setSelectedOuder("");
        setSelectedKind("");
        setOuderQuery("");
        setKindQuery("");
      }
    });
  };

  const handleBulkSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await createBulkChildrenAction(formData);
      setFeedback(res);
      if (res.success) {
        bulkFormRef.current?.reset();
        setSelectedOuder("");
        setOuderQuery("");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Mode Selector Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-md">
        <button
          type="button"
          onClick={() => { setMode("single"); setFeedback(null); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === "single" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          Enkele Relatie Leggen
        </button>
        <button
          type="button"
          onClick={() => { setMode("bulk"); setFeedback(null); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === "bulk" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          🚀 Bulk Kinderen Genereren
        </button>
      </div>

      {/* MODE 1: SINGLE LINK */}
      {mode === "single" && (
        <form ref={singleFormRef} action={handleSingleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Bestaande objecten aan elkaar knopen</h3>
          
          {/* Verborgen inputs zodat de bestaande Server Actions de juiste ID's binnenkrijgen via FormData */}
          <input type="hidden" name="vanObjectId" value={selectedOuder} />
          <input type="hidden" name="naarObjectId" value={selectedKind} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* OUDER SELECTION */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Van Object (Ouder)</label>
              <input 
                type="text"
                placeholder="Zoek ouder..."
                value={ouderQuery}
                onChange={(e) => setOuderQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs h-7 focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
              />
              <select value={selectedOuder} onChange={(e) => setSelectedOuder(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                <option value="">
                  {isSearchingOuder ? "Zoeken..." : ouderQuery.trim().length < 2 ? "-- Typ om te zoeken --" : `-- Resultaten (${dynamischeOuders.length}) --`}
                </option>
                {dynamischeOuders.map((o) => <option key={o.id} value={o.id}>{o.weergaveNaam} ({o.id})</option>)}
              </select>
            </div>

            {/* RELATIETYPE */}
            <div className="space-y-1 justify-end flex flex-col">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Relatietype</label>
              <select name="relatieTypeId" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                <option value="">-- Kies type --</option>
                {relatieTypen.map((r) => <option key={r.id} value={r.id}>{r.omschrijving}</option>)}
              </select>
            </div>

            {/* KIND SELECTION */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Naar Object (Kind)</label>
              <input 
                type="text"
                placeholder="Zoek kind..."
                value={kindQuery}
                onChange={(e) => setKindQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs h-7 focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
              />
              <select value={selectedKind} onChange={(e) => setSelectedKind(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                <option value="">
                  {isSearchingKind ? "Zoeken..." : kindQuery.trim().length < 2 ? "-- Typ om te zoeken --" : `-- Resultaten (${dynamischeKinderen.length}) --`}
                </option>
                {dynamischeKinderen.map((o) => <option key={o.id} value={o.id}>{o.weergaveNaam} ({o.id})</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volgorde-index</label>
              <input type="number" name="volgorde" defaultValue="0" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={isPending || !selectedOuder || !selectedKind} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg h-10 transition-colors disabled:bg-slate-400">
                {isPending ? "Koppelen..." : "Relatie Opslaan"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* MODE 2: BULK GENERATOR */}
      {mode === "bulk" && (
        <form ref={bulkFormRef} action={handleBulkSubmit} className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-blue-900">In één klap nieuwe objecten maken én koppelen</h3>
          
          <input type="hidden" name="vanObjectId" value={selectedOuder} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* BULK OUDER SELECTION */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Kies de Ouder (Bron)</label>
              <input 
                type="text"
                placeholder="Zoek ouder..."
                value={ouderQuery}
                onChange={(e) => setOuderQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs h-7 focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
              />
              <select value={selectedOuder} onChange={(e) => setSelectedOuder(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                <option value="">
                  {isSearchingOuder ? "Zoeken..." : ouderQuery.trim().length < 2 ? "-- Typ om te zoeken --" : `-- Resultaten (${dynamischeOuders.length}) --`}
                </option>
                {dynamischeOuders.map((o) => <option key={o.id} value={o.id}>{o.weergaveNaam} ({o.id})</option>)}
              </select>
            </div>

            {/* RELATIETYPE */}
            <div className="space-y-1 justify-end flex flex-col">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Relatietype</label>
              <select name="relatieTypeId" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                <option value="">-- Kies type --</option>
                {relatieTypen.map((r) => <option key={r.id} value={r.id}>{r.omschrijving}</option>)}
              </select>
            </div>

            {/* KIND OBJECT TYPE */}
            <div className="space-y-1 justify-end flex flex-col">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Wat voor type zijn de kinderen?</label>
              <select name="kindObjectType" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                <option value="">-- Kies Objecttype --</option>
                {objectTypen.map((t) => <option key={t.id} value={t.id}>{t.omschrijving}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Basisnaam (Er wordt automatisch " #num" achter geplakt)</label>
              <input type="text" name="basisNaam" required placeholder="Bijv: Plank, Compartiment, Specimen" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Aantal te maken (max 50)</label>
              <input type="number" name="aantal" required min="1" max="50" placeholder="Bijv: 6" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start volgnummer</label>
              <input type="number" name="startVolgorde" defaultValue="1" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
            </div>
          </div>

          <button type="submit" disabled={isPending || !selectedOuder} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg h-10 transition-colors disabled:bg-slate-400">
            {isPending ? "Genereren & Koppelen..." : "🚀 Start Bulk Generatie"}
          </button>
        </form>
      )}

      {feedback && (
        <div className={`p-3 rounded-lg text-xs font-medium ${feedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}