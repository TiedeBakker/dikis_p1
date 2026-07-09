"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { getBasistabellenData, createBasistabelItemAction, updateBasistabelItemAction } from "@/app/actions/basistabellen";

interface Props {
  initialData: { typen: any[]; relaties: any[]; meeteenheden: any[]; };
}

interface SelectedItem {
  tabel: "object" | "relatie" | "eenheid";
  id: string;
  omschrijving: string;
  symbool?: string;
  toelichting?: string; // STAP 1: Uitbreiding type
}

export default function BasistabellenDashboard({ initialData }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [zoekterm, setZoekterm] = useState("");
  const [actieveTabel, setActieveTabel] = useState<"object" | "relatie" | "eenheid">("object");
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  useEffect(() => { setData(initialData); }, [initialData]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const gefilterd = await getBasistabellenData(zoekterm);
      setData(gefilterd);
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [zoekterm]);

  // STAP 2: handleSelectEdit aangepast om toelichting over te nemen
  const handleSelectEdit = (tabel: "object" | "relatie" | "eenheid", item: any) => {
    setFeedback(null);
    setActieveTabel(tabel);
    setSelectedItem({
      tabel,
      id: item.id,
      omschrijving: item.omschrijving,
      symbool: item.symbool || "",
      toelichting: item.toelichting || "" 
    });
  };

  const handleAnnuleer = () => {
    setSelectedItem(null);
    setFeedback(null);
    formRef.current?.reset();
  };

  const handleSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      let res;
      if (selectedItem) {
        res = await updateBasistabelItemAction(selectedItem.tabel, selectedItem.id, formData);
      } else {
        res = await createBasistabelItemAction(actieveTabel, formData);
      }
      
      setFeedback(res);
      if (res.success) {
        if (!selectedItem) formRef.current?.reset();
        setSelectedItem(null);
        const geupdate = await getBasistabellenData(zoekterm);
        setData(geupdate);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. LIVE FILTER BALK */}
      <div className="bg-slate-100 p-3 rounded-xl">
        <input
          type="text"
          placeholder="🔍 Typ om direct te zoeken in álle basistabellen..."
          value={zoekterm}
          onChange={(e) => setZoekterm(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 shadow-sm"
        />
      </div>

      {/* 2. DYNAMISCH FORMULIER (AANMAKEN / BEWERKEN) */}
      <div className={`border rounded-xl p-4 sm:p-5 transition-colors ${selectedItem ? "bg-amber-50/60 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            {selectedItem ? `Stamdata Aanpassen (Tabel: ${selectedItem.tabel}typen, Sleutel: ${selectedItem.id})` : "Nieuwe stamdata toevoegen"}
          </h3>
          {selectedItem && (
            <button onClick={handleAnnuleer} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded font-medium">
              Annuleer Bewerken
            </button>
          )}
        </div>

        <form ref={formRef} key={selectedItem?.id || actieveTabel} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Kies Tabel</label>
            <select
              value={actieveTabel}
              disabled={!!selectedItem} 
              onChange={(e) => { setActieveTabel(e.target.value as any); setFeedback(null); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm h-10 focus:outline-none disabled:bg-slate-200 disabled:text-slate-500"
            >
              <option value="object">Object Typen</option>
              <option value="relatie">Relatie Typen</option>
              <option value="eenheid">Meeteenheden</option>
            </select>
          </div>
          
          <div className={actieveTabel === "eenheid" ? "sm:col-span-2" : "sm:col-span-3"}>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Unieke Code (ID)</label>
            <input 
              type="text" 
              name="id" 
              disabled={!!selectedItem} 
              defaultValue={selectedItem?.id || ""}
              required 
              placeholder="mm, cm, heeft_laag" 
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none disabled:bg-slate-200 disabled:text-slate-500" 
            />
          </div>
          
          <div className={actieveTabel === "eenheid" ? "sm:col-span-3" : "sm:col-span-4"}>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Omschrijving / Weergave</label>
            <input type="text" name="omschrijving" defaultValue={selectedItem?.omschrijving || ""} required placeholder="Bijv: Millimeter" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
          </div>

          {actieveTabel === "eenheid" && (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Symbool</label>
              <input type="text" name="symbool" defaultValue={selectedItem?.symbool || ""} required={actieveTabel === "eenheid"} placeholder="Bijv: mm" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
            </div>
          )}

          {/* STAP 3: TEXTAREA VOOR OBJECT- EN RELATIETYPEN (Verberg bij meeteenheden) */}
          {actieveTabel !== "eenheid" && (
            <div className="sm:col-span-12 mt-1">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Toelichting / Richtlijn voor gebruik</label>
              <textarea 
                name="toelichting" 
                defaultValue={selectedItem?.toelichting || ""} 
                placeholder="Beschrijf hier de betekenis en de kaders voor het gebruik van dit type..." 
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-16 focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>
          )}
          
          {/* De knop staat nu stabiel op de volledige breedte eronder */}
          <div className="sm:col-span-12 mt-2 sm:flex sm:justify-end">
            <button type="submit" disabled={isPending} className={`w-full sm:w-48 text-white font-medium text-sm rounded-lg h-10 transition-colors ${selectedItem ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}>
              {isPending ? "Verwerken..." : selectedItem ? "Wijzigen" : "Opslaan"}
            </button>
          </div>
        </form>

        {feedback && (
          <div className={`mt-3 p-2 rounded-lg text-xs font-medium ${feedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {feedback.message}
          </div>
        )}
      </div>

      {/* 3. DRIE KOLOMMEN OVERZICHT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KOLOM 1: OBJECT TYPEN */}
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-sm text-slate-900">📦 Object Typen</h4>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-mono font-bold">{data.typen.length}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {data.typen.map((t) => {
              const isSelected = selectedItem?.tabel === "object" && selectedItem.id === t.id;
              return (
                <div 
                  key={t.id} 
                  onClick={() => handleSelectEdit("object", t)}
                  className={`py-2 text-xs flex flex-col cursor-pointer transition-colors px-1 rounded ${isSelected ? "bg-amber-100 font-medium" : "hover:bg-slate-50"}`}
                >
                  <span className="font-bold text-slate-800">{t.omschrijving}</span>
                  <span className="font-mono text-[10px] text-slate-400">code: {t.id}</span>
                  {/* STAP 4: Subtiele preview van de documentatie */}
                  {t.toelichting && (
                    <p className="text-[11px] text-slate-500 italic mt-0.5 border-l-2 border-slate-200 pl-1.5 line-clamp-2">
                      {t.toelichting}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* KOLOM 2: RELATIE TYPEN */}
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-sm text-slate-900">🔗 Relatie Typen</h4>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-mono font-bold">{data.relaties.length}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {data.relaties.map((r) => {
              const isSelected = selectedItem?.tabel === "relatie" && selectedItem.id === r.id;
              return (
                <div 
                  key={r.id} 
                  onClick={() => handleSelectEdit("relatie", r)}
                  className={`py-2 text-xs flex flex-col cursor-pointer transition-colors px-1 rounded ${isSelected ? "bg-amber-100 font-medium" : "hover:bg-slate-50"}`}
                >
                  <span className="font-bold text-slate-800">{r.omschrijving}</span>
                  <span className="font-mono text-[10px] text-slate-400">code: {r.id}</span>
                  {/* STAP 4: Subtiele preview van de documentatie */}
                  {r.toelichting && (
                    <p className="text-[11px] text-slate-500 italic mt-0.5 border-l-2 border-slate-200 pl-1.5 line-clamp-2">
                      {r.toelichting}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* KOLOM 3: MEETWEENHEDEN (Onveranderd) */}
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-sm text-slate-900">📐 Meeteenheden</h4>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-mono font-bold">{data.meeteenheden.length}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {data.meeteenheden.map((e) => {
              const isSelected = selectedItem?.tabel === "eenheid" && selectedItem.id === e.id;
              return (
                <div 
                  key={e.id} 
                  onClick={() => handleSelectEdit("eenheid", e)}
                  className={`py-2 text-xs flex flex-col cursor-pointer transition-colors px-1 rounded ${isSelected ? "bg-amber-100 font-medium" : "hover:bg-slate-50"}`}
                >
                  <span className="font-bold text-slate-800">{e.omschrijving} ({e.symbool})</span>
                  <span className="font-mono text-[10px] text-slate-400">code: {e.id}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}