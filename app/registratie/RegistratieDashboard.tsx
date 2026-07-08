"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { getFormulierVeldenVoorSet, createWaarnemingenAction, getWaarnemingenHistorie } from "@/app/actions/waarnemingen";

interface Props {
  objecten: any[];
  sets: any[];
  alleParameters: any[];
  initialHistorie: any[];
}

export default function RegistratieDashboard({ objecten, sets, alleParameters, initialHistorie }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [historie, setHistorie] = useState(initialHistorie);

  const [selectedObject, setSelectedObject] = useState("");
  const [selectedSet, setSelectedSet] = useState("");
  
  // State voor incidentele parameters (los toegevoegd)
  const [losseParameters, setLosseParameters] = useState<any[]>([]);
  const [actieveFormVelden, setActieveFormVelden] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // 1. Haal de velden uit de geselecteerde set op
  useEffect(() => {
    if (selectedSet) {
      getFormulierVeldenVoorSet(selectedSet).then((setVelden) => {
        samenvoegenVelden(setVelden, losseParameters);
      });
    } else {
      samenvoegenVelden([], losseParameters);
    }
  }, [selectedSet, losseParameters]);

  // 2. Filter historie op geselecteerd object
  useEffect(() => {
    getWaarnemingenHistorie(selectedObject || undefined).then(setHistorie);
  }, [selectedObject]);

  // 3. Hulpfunctie om set-velden en losse velden zonder duplicaten samen te voegen
  // 3. Hulpfunctie om set-velden en losse velden zonder duplicaten samen te voegen
  const samenvoegenVelden = (setVelden: any[], losseVelden: any[]) => {
    const gecombineerd = [...setVelden];
    
    // Gecorrigeerd: spatie weggehaald en type toegevoegd
    losseVelden.forEach((losVeld: any) => {
      // Voorkom dat een parameter dubbel in het formulier komt als deze al in de set zat
      const bestaatAl = gecombineerd.some(v => v.parameterId === losVeld.id || v.parameterId === losVeld.parameterId);
      if (!bestaatAl) {
        gecombineerd.push({
          parameterId: losVeld.id,
          naam: losVeld.naam,
          dataType: losVeld.dataType,
          helpTekst: losVeld.helpTekst ? `${losVeld.helpTekst} (Incidenteel)` : "(Incidenteel toegevoegd)",
          keuzeOpties: losVeld.keuzeOpties,
          eenheidId: losVeld.eenheidId,
          isLosVeld: true // Vlag om visueel te herkennen
        });
      }
    });
    setActieveFormVelden(gecombineerd);
  };

  // Voeg een losse parameter toe aan het incidentele lijstje
  const handleVoegParameterToe = (parameterId: string) => {
    if (!parameterId) return;
    const geselecteerd = alleParameters.find(p => p.id === parameterId);
    if (geselecteerd && !losseParameters.some(p => p.id === parameterId)) {
      setLosseParameters([...losseParameters, geselecteerd]);
    }
  };

  // Verwijder een los toegevoegd veld
  const handleVerwijderLosVeld = (parameterId: string) => {
    setLosseParameters(losseParameters.filter(p => p.id !== parameterId));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedObject) return;

    setFeedback(null);
    const formData = new FormData(e.currentTarget);
    
    const fieldsData = actieveFormVelden.map(veld => ({
      parameterId: veld.parameterId,
      waarde: formData.get(veld.parameterId) as string
    }));

    startTransition(async () => {
      const res = await createWaarnemingenAction(selectedObject, fieldsData);
      setFeedback(res);
      
      if (res.success) {
        formRef.current?.reset();
        setLosseParameters([]); // Reset incidentele velden na succesvol opslaan
        const updateHist = await getWaarnemingenHistorie(selectedObject || undefined);
        setHistorie(updateHist);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-6">
          
          {/* STAP 1 & 2: SELECTIE OBJECT, SET, EN INCIDENTELE PARAMETERS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b pb-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">1. Selecteer Object</label>
              <select value={selectedObject} onChange={(e) => setSelectedObject(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500">
                <option value="">-- Kies een object --</option>
                {objecten.map(o => <option key={o.id} value={o.id}>{o.weergaveNaam} (type: {o.type})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">2. Kies Formulier-Set</label>
              <select value={selectedSet} onChange={(e) => setSelectedSet(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500">
                <option value="">-- Geen set (enkel losse parameters) --</option>
                {sets.map(s => <option key={s.id} value={s.id}>{s.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">➕ Incidentele Parameter</label>
              <select 
                value="" 
                disabled={!selectedObject}
                onChange={(e) => handleVoegParameterToe(e.target.value)} 
                className="w-full rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-sm h-10 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              >
                <option value="">-- Voeg losse parameter toe... --</option>
                {alleParameters.map(p => (
                  <option key={p.id} value={p.id}>{p.naam} ({p.dataType})</option>
                ))}
              </select>
            </div>
          </div>

          {/* DYNAMISCH COMPOSITE FORMULIER */}
          {selectedObject && (actieveFormVelden.length > 0 || selectedSet) ? (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">3. Invoeren Gegevens</h3>
                {losseParameters.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
                    {losseParameters.length} extra veld(en) actief
                  </span>
                )}
              </div>
              
              {actieveFormVelden.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4 text-center border-2 border-dashed rounded-xl">
                  Dit formulier is nog leeg. Selecteer een set of voeg hierboven incidentele parameters toe.
                </p>
              ) : (
                <div className="space-y-4">
                  {actieveFormVelden.map((veld) => {
                    return (
                      <div 
                        key={veld.parameterId} 
                        className={`flex flex-col sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start border-b border-slate-100 pb-3 last:border-0 p-2 rounded-lg transition-colors ${veld.isLosVeld ? "bg-amber-50/50 border-l-4 border-l-amber-400" : ""}`}
                      >
                        <div className="sm:pt-2 flex justify-between sm:flex-col">
                          <div>
                            <label className="block text-sm font-semibold text-slate-800">
                              {veld.naam}
                            </label>
                            {veld.helpTekst && <p className="text-xs text-slate-400 italic">{veld.helpTekst}</p>}
                          </div>
                          {veld.isLosVeld && (
                            <button 
                              type="button" 
                              onClick={() => handleVerwijderLosVeld(veld.parameterId)} 
                              className="text-xs text-red-500 hover:text-red-700 font-medium sm:mt-1 self-start"
                            >
                              Verwijder veld
                            </button>
                          )}
                        </div>

                        <div className="mt-1 sm:mt-0 sm:col-span-2">
                          {veld.dataType === "tekst" && (
                            <input type="text" name={veld.parameterId} placeholder="Voer tekst in..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500" />
                          )}

                          {veld.dataType === "numeriek" && (
                            <div className="relative rounded-lg shadow-sm w-full">
                              <input type="number" step="any" name={veld.parameterId} placeholder="0.00" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500 pr-16" />
                              {veld.eenheidId && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-bold text-slate-400 bg-slate-50 border-l px-3 rounded-r-lg">
                                  {veld.eenheidId}
                                </div>
                              )}
                            </div>
                          )}

                          {veld.dataType === "keuzelijst" && (
                            <select name={veld.parameterId} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500">
                              <option value="">-- Maak een keuze --</option>
                              {veld.keuzeOpties && JSON.parse(veld.keuzeOpties).map((optie: string) => (
                                <option key={optie} value={optie}>{optie}</option>
                              ))}
                            </select>
                          )}

                          {veld.dataType === "datum" && (
                            <input type="datetime-local" name={veld.parameterId} defaultValue={new Date().toISOString().slice(0, 16)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button type="submit" disabled={isPending || actieveFormVelden.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg h-11 transition-colors shadow-md disabled:bg-slate-300">
                    {isPending ? "Metingen opslaan..." : "✍️ Alle Metingen Definitief Opslaan"}
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
              💡 Selecteer hierboven eerst een object om te beginnen. Daarna kun je een set kiezen of direct ad-hoc parameters injecteren.
            </div>
          )}

          {feedback && (
            <div className={`p-3 rounded-lg text-xs font-medium ${feedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {feedback.message}
            </div>
          )}
        </div>
      </div>

      {/* FEED RECHTERKOLOM BLIJFT GELIJK */}
      <div className="lg:col-span-1">
        <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 shadow-lg space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
              {selectedObject ? "Metingen voor dit object" : "Laatste Systeemmetingen"}
            </h3>
            <p className="text-[11px] text-slate-400">Gekoppeld aan het EAV-datamodel.</p>
          </div>

          <div className="space-y-3 max-h-125 overflow-y-auto pr-1 text-xs divide-y divide-slate-800">
            {historie.length === 0 ? (
              <p className="text-slate-500 italic py-4 text-center">Nog geen metingen geregistreerd.</p>
            ) : (
              historie.map((h: any) => (
                <div key={h.id} className="pt-2 first:pt-0 flex flex-col space-y-0.5">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-200">{h.parameterNaam}</span>
                    <span className="text-emerald-400 font-mono font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-900/40">
                      {h.waarde}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="font-mono">Object: {h.objectId}</span>
                    <span>{new Date(h.tijdstipUtc).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}