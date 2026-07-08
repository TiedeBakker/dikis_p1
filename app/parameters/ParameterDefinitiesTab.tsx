"use client";

import { useRef, useTransition, useState, useEffect } from "react";
import { createParameterDefinitieAction, updateParameterDefinitieAction, getParameterDefinities } from "@/app/actions/parameters";

interface Props {
  definities: any[];
  eenheden: any[];
}

export default function ParameterDefinitiesTab({ definities: initialDefinities, eenheden }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // States voor bewerken, filteren en dynamische lijst
  const [selectedParam, setSelectedParam] = useState<any | null>(null);
  const [filteredDefinities, setFilteredDefinities] = useState<any[]>(initialDefinities);
  const [selectedType, setSelectedType] = useState<string>("tekst");
  const [zoekterm, setZoekterm] = useState("");
  const [filterType, setFilterType] = useState("");

  // Update lokale lijst als server data ververst
  useEffect(() => { setFilteredDefinities(initialDefinities); }, [initialDefinities]);

  // Sync het datatype van het formulier als je een andere parameter selecteert
  useEffect(() => {
    if (selectedParam) {
      setSelectedType(selectedParam.dataType);
    }
  }, [selectedParam]);

  // Debounced live zoekopdracht naar de database
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const data = await getParameterDefinities({ dataType: filterType, zoekterm: zoekterm });
      setFilteredDefinities(data);
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [zoekterm, filterType]);

  const handleSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      let res;
      if (selectedParam) {
        res = await updateParameterDefinitieAction(selectedParam.id, formData);
      } else {
        res = await createParameterDefinitieAction(formData);
      }
      setFeedback(res);
      if (res.success && !selectedParam) {
        formRef.current?.reset();
        setSelectedType("tekst");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. DYNAMISCH FORMULIER (Aanmaken / Bewerken) */}
      <div className={`border rounded-xl p-4 sm:p-5 transition-colors ${selectedParam ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            {selectedParam ? `Parameter Aanpassen: ${selectedParam.id}` : "Nieuw Veld / Parameter Definiëren"}
          </h3>
          {selectedParam && (
            <button 
              onClick={() => { setSelectedParam(null); setFeedback(null); setSelectedType("tekst"); formRef.current?.reset(); }}
              className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded"
            >
              Annuleer Bewerken
            </button>
          )}
        </div>

        <form ref={formRef} key={selectedParam?.id} action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Unieke Code / ID</label>
              <input
                type="text"
                name="id"
                disabled={!!selectedParam} // ID mag NOOIT aangepast worden bij een update
                defaultValue={selectedParam?.id || ""}
                required
                placeholder="temp_celsius"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none disabled:bg-slate-200 disabled:text-slate-500"
              />
              {selectedParam && <input type="hidden" name="id" value={selectedParam.id} />}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Naam (Weergave)</label>
              <input type="text" name="naam" defaultValue={selectedParam?.naam || ""} required placeholder="Temperatuur" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Datatype</label>
              <select name="dataType" value={selectedType} onChange={(e) => setSelectedType(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                <option value="tekst">Tekstregel (string)</option>
                <option value="numeriek">Numeriek (getal)</option>
                <option value="keuzelijst">Keuzelijst (dropdown)</option>
                <option value="datum">Datum & Tijd</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Helptekst / Instructie (Optioneel)</label>
              <input type="text" name="helpTekst" defaultValue={selectedParam?.helpTekst || ""} placeholder="Instructie voor in het veld" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none" />
            </div>

            {selectedType === "numeriek" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Meeteenheid</label>
                <select name="eenheidId" defaultValue={selectedParam?.eenheidId || ""} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none">
                  <option value="">-- Geen eenheid --</option>
                  {eenheden.map((e) => <option key={e.id} value={e.id}>{e.omschrijving} ({e.id})</option>)}
                </select>
              </div>
            )}

            {selectedType === "keuzelijst" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Keuzeopties (Kommagescheiden)</label>
                <input
                  type="text"
                  name="keuzeOpties"
                  required
                  defaultValue={selectedParam?.keuzeOpties ? JSON.parse(selectedParam.keuzeOpties).join(", ") : ""}
                  placeholder="Goed, Matig, Slecht"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none"
                />
              </div>
            )}
          </div>

          <button type="submit" disabled={isPending} className={`w-full text-white font-medium text-sm rounded-lg h-10 transition-colors ${selectedParam ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}>
            {isPending ? "Opslaan..." : selectedParam ? "Wijzigingen Opslaan" : "Parameter Aanmaken"}
          </button>
        </form>
        {feedback && (
          <div className={`mt-3 p-3 rounded-lg text-xs font-medium ${feedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {feedback.message}
          </div>
        )}
      </div>

      {/* 2. COMPACT FILTER VENSTER */}
      <div className="bg-slate-100 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-medium text-slate-600 mb-1">Snel zoeken op naam</label>
          <input type="text" placeholder="Typ om te filteren..." value={zoekterm} onChange={(e) => setZoekterm(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 focus:outline-none" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Filter op Datatype</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 focus:outline-none">
            <option value="">-- Alle typen --</option>
            <option value="tekst">Tekstregel</option>
            <option value="numeriek">Numeriek</option>
            <option value="keuzelijst">Keuzelijst</option>
            <option value="datum">Datum & Tijd</option>
          </select>
        </div>
      </div>

      {/* 3. LIST VIEW */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          Beschikbare Parameters <span className="text-xs font-normal text-slate-500">(Toont top 20, klik om te wijzigen)</span>
        </h3>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">ID / Code</th>
                <th className="px-4 py-3">Naam</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Details / Helptekst</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-600 bg-white">
              {filteredDefinities.map((def) => {
                const isSelected = selectedParam?.id === def.id;
                return (
                  <tr 
                    key={def.id} 
                    onClick={() => setSelectedParam(def)}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-amber-50 hover:bg-amber-100 font-medium" : "hover:bg-slate-50"}`}
                  >
                    <td className={`px-4 py-3 font-mono text-xs font-bold ${isSelected ? "text-amber-800" : "text-slate-900"}`}>{def.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{def.naam}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{def.dataType}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                      {def.eenheidId && <span className="font-bold text-slate-700">[{def.eenheidId}] </span>}
                      {def.keuzeOpties && `Opties: ${JSON.parse(def.keuzeOpties).join(", ")}`}
                      {def.helpTekst && <span className="block text-[11px] italic text-slate-400">{def.helpTekst}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}