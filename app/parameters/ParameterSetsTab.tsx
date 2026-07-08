"use client";

import { useRef, useTransition, useState, useEffect } from "react";
import { createParameterSetAction, linkParameterToSetAction, getParameterSetLijnen } from "@/app/actions/parameters";

interface Props {
  sets: any[];
  definities: any[];
}

export default function ParameterSetsTab({ sets, definities }: Props) {
  const setFormRef = useRef<HTMLFormElement>(null);
  const lineFormRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [setLijnen, setSetLijnen] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Laad de gekoppelde parameters zodra een set geselecteerd is
  useEffect(() => {
    if (selectedSetId) {
      getParameterSetLijnen(selectedSetId).then(setSetLijnen);
    } else {
      setSetLijnen([]);
    }
  }, [selectedSetId, sets]);

  const handleCreateSet = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await createParameterSetAction(formData);
      setFeedback(res);
      if (res.success) setFormRef.current?.reset();
    });
  };

  const handleLinkParameter = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await linkParameterToSetAction(formData);
      setFeedback(res);
      if (res.success) {
        lineFormRef.current?.reset();
        // Ververs direct de lijnen in beeld
        getParameterSetLijnen(selectedSetId).then(setSetLijnen);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LINKER KOLOM: SETS AANMAKEN EN KIEZEN */}
      <div className="space-y-6 lg:col-span-1">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Nieuwe Groep / Set Aanmaken</h3>
          <form ref={setFormRef} action={handleCreateSet} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-0.5">Set Code (ID)</label>
              <input type="text" name="id" required placeholder="Bijv: klimaat_set, insect_basis" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-0.5">Naam Set</label>
              <input type="text" name="naam" required placeholder="Bijv: Klimaatmetingen" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none" />
            </div>
            <button type="submit" disabled={isPending} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg py-2 transition-colors">
              Groep Opslaan
            </button>
          </form>
        </div>

        {/* SELECTIE LIJST VAN GROEPEN */}
        <div className="border border-slate-200 rounded-xl p-4 bg-white">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Kies een Set om in te richten</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {sets.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedSetId(s.id); setFeedback(null); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedSetId === s.id ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
              >
                {s.naam} <span className={`block text-[10px] ${selectedSetId === s.id ? "text-blue-200" : "text-slate-400"} font-mono`}>{s.id}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RECHTER KOLOM: PARAMETERS INRICHTEN BINNEN DE SET */}
      <div className="lg:col-span-2 space-y-6">
        {selectedSetId ? (
          <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Inrichting van Set: <span className="text-blue-600">{sets.find(s => s.id === selectedSetId)?.naam}</span>
              </h3>
              <p className="text-xs text-slate-500">Voeg parameters toe en bepaal de formuliervolgorde.</p>
            </div>

            {/* Formulier om parameter toe te voegen aan actieve set */}
            <form ref={lineFormRef} action={handleLinkParameter} className="bg-slate-50 border p-3 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <input type="hidden" name="parameterSetId" value={selectedSetId} />
              
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Kies Parameter om toe te voegen</label>
                <select name="parameterId" required className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs h-9 focus:outline-none">
                  <option value="">-- Kies parameter --</option>
                  {definities.map((d) => (
                    <option key={d.id} value={d.id}>{d.naam} ({d.dataType})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Volgorde Index</label>
                <input type="number" name="volgorde" defaultValue={(setLijnen.length + 1) * 10} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs h-9 focus:outline-none" />
              </div>

              <button type="submit" disabled={isPending} className="sm:col-span-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg h-9 transition-colors">
                Voeg Parameter Toe aan Set
              </button>
            </form>

            {/* Overzicht van de lijnen/velden in de set */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Gekoppelde Velden in dit formulier</h4>
              {setLijnen.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Deze set bevat nog geen parameters. Gebruik het bovenstaande formulier om velden toe te voegen.</p>
              ) : (
                <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                  {setLijnen.map((lijn) => (
                    <div key={lijn.parameterId} className="flex justify-between items-center p-3 text-xs hover:bg-slate-50 transition-colors">
                      <div>
                        <span className="font-bold text-slate-900">{lijn.naam}</span>
                        <span className="ml-2 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{lijn.dataType}</span>
                      </div>
                      <span className="font-mono bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px]">
                        Volgorde: {lijn.volgorde}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center p-8 text-center text-slate-400 text-sm">
            Kies aan de linkerkant een parameter set om de formulier-velden in te richten.
          </div>
        )}
      </div>

      {feedback && (
        <div className="lg:col-span-3 p-3 rounded-lg text-xs font-medium bg-slate-100 text-slate-800">
          {feedback.message}
        </div>
      )}
    </div>
  );
}