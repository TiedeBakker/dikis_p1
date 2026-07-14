// app/registratie/RegistratieDashboard.tsx
"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { getFormulierVeldenVoorSet, createWaarnemingenAction, getWaarnemingenHistorie, getLaatsteWaardenVoorObjectAction } from "@/app/actions/waarnemingen";
import { searchObjectenAction } from "@/app/actions/objecten";
// Let op: Zorg dat je deze server-action hebt of aanmaakt om een individuele meting te updaten
import { updateWaarnemingAction } from "@/app/actions/waarnemingen";

interface Props {
  objecten: any[];
  sets: any[];
  alleParameters: any[];
  initialHistorie: any[];
}

export default function RegistratieDashboard({ objecten, sets, alleParameters, initialHistorie }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isCorrecting, startCorrectTransition] = useTransition();
  const [historie, setHistorie] = useState(initialHistorie);

  const [selectedObject, setSelectedObject] = useState("");
  const [selectedSet, setSelectedSet] = useState("");

  const [losseParameters, setLosseParameters] = useState<any[]>([]);
  const [actieveFormVelden, setActieveFormVelden] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Staat voor het overkoepelende registratiemoment (standaard NU)
  const [registratieTijdstip, setRegistratieTijdstip] = useState(() => {
    return new Date().toISOString().slice(0, 16);
  });

  // Zoektermen voor de filters bovenin
  const [objectQuery, setObjectQuery] = useState("");
  const [setQuery, setSetQuery] = useState("");
  const [paramQuery, setParamQuery] = useState("");

  // Dynamische staat voor de objecten
  const [dynamischeObjecten, setDynamischeObjecten] = useState<any[]>([]);
  const [isSearchingObjects, setIsSearchingObjects] = useState(false);
  const [laatsteWaarden, setLaatsteWaarden] = useState<Record<string, { waarde: string; tijdstipUtc: string }>>({});

  // --- FILTERS VOOR DE ONDERSTE HISTORIE-TABEL ---
  const [filterVanDatum, setFilterVanDatum] = useState("");
  const [filterTotDatum, setFilterTotDatum] = useState("");
  const [filterParameter, setFilterParameter] = useState("");

  // --- CORRECTIE MODAL STATE ---
  const [editingMeting, setEditingMeting] = useState<any | null>(null);
  const [correctieWaarde, setCorrectieWaarde] = useState("");
  const [correctieTijdstip, setCorrectieTijdstip] = useState(""); // <-- NIEUW
  const [correctieFeedback, setCorrectieFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // LIVE SERVER-SIDE ZOEKOPDRACHT VOOR OBJECTEN (Debounced)
  useEffect(() => {
    if (objectQuery.trim().length < 2) {
      setDynamischeObjecten([]);
      return;
    }

    setIsSearchingObjects(true);
    const delayDebounceFn = setTimeout(async () => {
      const resultaten = await searchObjectenAction(objectQuery);
      setDynamischeObjecten(resultaten);
      setIsSearchingObjects(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [objectQuery]);

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

  // 3. Haal de laatste waarden op op basis van object, velden én de gekozen datum
  useEffect(() => {
    if (!selectedObject || actieveFormVelden.length === 0) {
      setLaatsteWaarden({});
      return;
    }

    const paramIds = actieveFormVelden.map((v) => v.parameterId);

    const filterTijdstipUtc = registratieTijdstip
      ? new Date(registratieTijdstip).toISOString()
      : new Date().toISOString();

    getLaatsteWaardenVoorObjectAction(selectedObject, paramIds, filterTijdstipUtc).then((data) => {
      setLaatsteWaarden(data);
    });
  }, [selectedObject, actieveFormVelden, registratieTijdstip]);

  // Hulpfunctie om set-velden en losse velden samen te voegen
  const samenvoegenVelden = (setVelden: any[], losseVelden: any[]) => {
    const gecombineerd = [...setVelden];
    losseVelden.forEach((losVeld: any) => {
      const bestaatAl = gecombineerd.some(v => v.parameterId === losVeld.id || v.parameterId === losVeld.parameterId);
      if (!bestaatAl) {
        gecombineerd.push({
          parameterId: losVeld.id,
          naam: losVeld.naam,
          dataType: losVeld.dataType,
          helpTekst: losVeld.helpTekst ? `${losVeld.helpTekst} (Incidenteel)` : "(Incidenteel toegevoegd)",
          keuzeOpties: losVeld.keuzeOpties,
          eenheidId: losVeld.eenheidId,
          isLosVeld: true
        });
      }
    });
    setActieveFormVelden(gecombineerd);
  };

  const handleVoegParameterToe = (parameterId: string) => {
    if (!parameterId) return;
    const geselecteerd = alleParameters.find(p => p.id === parameterId);
    if (geselecteerd && !losseParameters.some(p => p.id === parameterId)) {
      setLosseParameters([...losseParameters, geselecteerd]);
      setParamQuery("");
    }
  };

  const handleVerwijderLosVeld = (parameterId: string) => {
    setLosseParameters(losseParameters.filter(p => p.id !== parameterId));
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.stopPropagation();
    }
  };

  const gefilterdeSets = sets.filter((s) => {
    const term = setQuery.toLowerCase();
    return s.naam?.toLowerCase().includes(term) || s.id?.toLowerCase().includes(term);
  });

  const gefilterdeParameters = alleParameters.filter((p) => {
    const term = paramQuery.toLowerCase();
    return p.naam?.toLowerCase().includes(term) || p.id?.toLowerCase().includes(term) || p.dataType?.toLowerCase().includes(term);
  });

  // Filters toepassen op de tabel onderaan
  const gefilterdeHistorieTabel = historie.filter((h: any) => {
    // Filter op parameter
    if (filterParameter && h.parameterId !== filterParameter) {
      return false;
    }
    // Filter op Van-datum
    if (filterVanDatum) {
      const vanDate = new Date(filterVanDatum);
      const metingDate = new Date(h.tijdstipUtc);
      if (metingDate < vanDate) return false;
    }
    // Filter op Tot-datum
    if (filterTotDatum) {
      const totDate = new Date(filterTotDatum);
      const metingDate = new Date(h.tijdstipUtc);
      if (metingDate > totDate) return false;
    }
    return true;
  });

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
      const res = await createWaarnemingenAction(selectedObject, fieldsData, registratieTijdstip);
      setFeedback(res);
      if (res.success) {
        formRef.current?.reset();
        setLosseParameters([]);
        setRegistratieTijdstip(new Date().toISOString().slice(0, 16));

        const updateHist = await getWaarnemingenHistorie(selectedObject || undefined);
        setHistorie(updateHist);

        const paramIds = actieveFormVelden.map((v) => v.parameterId);
        const upToDateWaarden = await getLaatsteWaardenVoorObjectAction(selectedObject, paramIds);
        setLaatsteWaarden(upToDateWaarden);
      }
    });
  };

  // Openen van de correctie-modal bij dubbelklik
  const handleRowDoubleClick = (meting: any) => {
    setEditingMeting(meting);
    setCorrectieWaarde(meting.waarde);

    // Converteer UTC tijdstip uit db naar lokaal datetime-local formaat (YYYY-MM-DDTHH:MM)
    if (meting.tijdstipUtc) {
      const lokaleDatum = new Date(meting.tijdstipUtc);
      // Compenseer voor tijdzone-offset om de juiste lokale tijd te tonen in de input
      const offset = lokaleDatum.getTimezoneOffset() * 60000;
      const lokaalIso = new Date(lokaleDatum.getTime() - offset).toISOString().slice(0, 16);
      setCorrectieTijdstip(lokaalIso);
    } else {
      setCorrectieTijdstip("");
    }

    setCorrectieFeedback(null);
  };
  // Correctie opslaan
  const handleSaveCorrectie = () => {
    if (!editingMeting) return;

    startCorrectTransition(async () => {
      // We sturen nu de ID, de gecorrigeerde waarde én het gecorrigeerde lokale tijdstip mee
      const res = await updateWaarnemingAction(editingMeting.id, correctieWaarde, correctieTijdstip);
      setCorrectieFeedback(res);
      if (res.success) {
        // Sluit modal na korte vertraging en ververs de data
        setTimeout(async () => {
          setEditingMeting(null);
          const updateHist = await getWaarnemingenHistorie(selectedObject || undefined);
          setHistorie(updateHist);

          // Update ook direct de laatste waarden in het invoerformulier
          const paramIds = actieveFormVelden.map((v) => v.parameterId);
          const upToDateWaarden = await getLaatsteWaardenVoorObjectAction(selectedObject, paramIds);
          setLaatsteWaarden(upToDateWaarden);
        }, 800);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b pb-4 items-start">

              {/* 1. OBJECT SELECTIE */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">1. Selecteer Object</label>
                <input
                  type="text"
                  placeholder="Typ min. 2 letters van soort..."
                  value={objectQuery}
                  onChange={(e) => setObjectQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs h-7 focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
                />
                <select value={selectedObject} onChange={(e) => setSelectedObject(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs h-9 focus:outline-none focus:border-blue-500">
                  <option value="">
                    {isSearchingObjects ? "Zoeken in database..." : objectQuery.trim().length < 2 ? "-- Typ om te zoeken --" : `-- Resultaten (${dynamischeObjecten.length}) --`}
                  </option>
                  {dynamischeObjecten.map(o => (
                    <option key={o.id} value={o.id}>{o.weergaveNaam} ({o.id})</option>
                  ))}
                </select>
              </div>

              {/* 2. FORMULIER-SET SELECTIE */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">2. Kies Formulier-Set</label>
                <input
                  type="text"
                  placeholder="Zoek set..."
                  value={setQuery}
                  onChange={(e) => setSetQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs h-7 focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
                />
                <select value={selectedSet} onChange={(e) => setSelectedSet(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs h-9 focus:outline-none focus:border-blue-500">
                  <option value="">-- Enkel losse parameters ({gefilterdeSets.length}) --</option>
                  {gefilterdeSets.map(s => <option key={s.id} value={s.id}>{s.naam}</option>)}
                </select>
              </div>

              {/* 3. INCIDENTELE PARAMETER SELECTIE */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider">➕ Incidentele Parameter</label>
                <input
                  type="text"
                  placeholder="Zoek parameter..."
                  value={paramQuery}
                  disabled={!selectedObject}
                  onChange={(e) => setParamQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs h-7 focus:outline-none focus:border-amber-500 disabled:opacity-50 placeholder:text-slate-400"
                />
                <select
                  value=""
                  disabled={!selectedObject}
                  onChange={(e) => handleVoegParameterToe(e.target.value)}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-1.5 text-xs h-9 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                >
                  <option value="">
                    {gefilterdeParameters.length === 0 ? "-- Geen resultaten --" : `-- Voeg toe ({gefilterdeParameters.length}) --`}
                  </option>
                  {gefilterdeParameters.map(p => (
                    <option key={p.id} value={p.id}>{p.naam} ({p.dataType})</option>
                  ))}
                </select>
              </div>

            </div>

            {/* DYNAMISCH COMPOSITE FORMULIER */}
            {selectedObject && (actieveFormVelden.length > 0 || selectedSet) ? (
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">3. Invoeren Gegevens</h3>

                  {/* GLOBAL TIMESTAMPER OVERRIDE */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg self-start sm:self-auto shadow-sm">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">📅 Tijdstip meting:</label>
                    <input
                      type="datetime-local"
                      value={registratieTijdstip}
                      onChange={(e) => setRegistratieTijdstip(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-blue-500 text-slate-800 font-medium"
                    />
                  </div>
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

                          <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-1.5">

                            {veld.dataType === "tekst" && (
                              <input type="text" name={veld.parameterId} placeholder="Voer tekst in..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500" />
                            )}

                            {veld.dataType === "textarea" && (
                              <textarea
                                name={veld.parameterId}
                                placeholder="Voer tekst in op meerdere regels... (Enter voor nieuwe regel)"
                                rows={3}
                                onKeyDown={handleTextareaKeyDown}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[80px]"
                              />
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

                            {laatsteWaarden[veld.parameterId] && (
                              <p className="text-[11px] text-slate-500 flex items-center flex-wrap gap-1 pl-1">
                                <span className="font-medium text-slate-400">Laatste waarde:</span>
                                <strong className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono whitespace-pre-wrap text-left">
                                  {laatsteWaarden[veld.parameterId].waarde} {veld.dataType === "numeriek" && veld.eenheidId}
                                </strong>
                                <span className="text-slate-400 font-light">
                                  ({new Date(laatsteWaarden[veld.parameterId].tijdstipUtc).toLocaleDateString('nl-NL', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })})
                                </span>
                              </p>
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

        {/* RECHTERKOLOM (SNEL OVERZICHT) */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 shadow-lg space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                {selectedObject ? "Snel overzicht object" : "Laatste Systeemmetingen"}
              </h3>
              <p className="text-[11px] text-slate-400">Snel overzicht van de meest recente waarden.</p>
            </div>

            <div className="space-y-3 max-h-125 overflow-y-auto pr-1 text-xs divide-y divide-slate-800">
              {historie.length === 0 ? (
                <p className="text-slate-500 italic py-4 text-center">Nog geen metingen geregistreerd.</p>
              ) : (
                historie.slice(0, 10).map((h: any) => (
                  <div key={h.id} className="pt-2 first:pt-0 flex flex-col space-y-0.5">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-200">{h.parameterNaam}</span>
                      <span className="text-emerald-400 font-mono font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-900/40 whitespace-pre-wrap text-right">
                        {h.waarde}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span className="font-mono">Object: {h.objectId}</span>
                      <span>{new Date(h.tijdstipUtc).toLocaleTimeString([], {
                        day: '2-digit',
                        month: 'short', hour: '2-digit', minute: '2-digit'
                      })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* ONDERSTE SECTIE: INTERACTIEVE TABEL VOOR DETAILED METINGEN & CORRECTIE */}
      {/* ========================================================================= */}
      {selectedObject && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">📋 Complete historie & correctie</h3>
              <p className="text-xs text-slate-500">Dubbelklik op een meting om direct een correctie door te voeren.</p>
            </div>

            {/* FILTERS */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto text-xs">
              <input
                type="date"
                value={filterVanDatum}
                onChange={(e) => setFilterVanDatum(e.target.value)}
                title="Vanaf datum"
                className="rounded border border-slate-300 px-2 py-1 focus:outline-none focus:border-blue-500"
              />
              <input
                type="date"
                value={filterTotDatum}
                onChange={(e) => setFilterTotDatum(e.target.value)}
                title="Tot datum"
                className="rounded border border-slate-300 px-2 py-1 focus:outline-none focus:border-blue-500"
              />
              <select
                value={filterParameter}
                onChange={(e) => setFilterParameter(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Alle parameters --</option>
                {Array.from(new Set(historie.map((h: any) => h.parameterId))).map((paramId) => {
                  const paramNaam = historie.find((h: any) => h.parameterId === paramId)?.parameterNaam || paramId;
                  return <option key={paramId} value={paramId}>{paramNaam}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Tijdstip (Meting)</th>
                  <th className="px-4 py-3">Parameter / Kenmerk</th>
                  <th className="px-4 py-3">Geregistreerde waarde</th>
                  <th className="px-4 py-3">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600 bg-white">
                {gefilterdeHistorieTabel.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                      Geen metingen gevonden die voldoen aan de geselecteerde criteria.
                    </td>
                  </tr>
                ) : (
                  gefilterdeHistorieTabel.map((meting: any) => (
                    <tr
                      key={meting.id}
                      onDoubleClick={() => handleRowDoubleClick(meting)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors select-none"
                      title="Dubbelklik om te corrigeren"
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-950">
                        {new Date(meting.tijdstipUtc).toLocaleString('nl-NL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{meting.parameterNaam}</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 whitespace-pre-wrap max-w-md">
                        {meting.waarde}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium capitalize">
                          {meting.dataType || "Onbekend"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CORRECTIE POP-UP (MODAL) */}
      {/* ========================================================================= */}
      {editingMeting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden transform transition-all">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-slate-900">✍️ Meting Corrigeren</h4>
                <p className="text-[10px] text-slate-500">Correctie voor {editingMeting.parameterNaam}</p>
              </div>
              <button
                onClick={() => setEditingMeting(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-2.5 text-[11px] space-y-1 border border-slate-100">
                <p><span className="font-semibold text-slate-500">Object:</span> <span className="font-mono text-slate-800">{editingMeting.objectId}</span></p>
                <p><span className="font-semibold text-slate-500">Geregistreerd door:</span> <span className="text-slate-800">{editingMeting.ingevoerdDoorObjectId || "Systeem"}</span></p>
              </div>

              {/* 1. NIEUW: CORRECTIE VAN HET TIJDSTIP */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">📅 Tijdstip van de Meting</label>
                <input
                  type="datetime-local"
                  value={correctieTijdstip}
                  onChange={(e) => setCorrectieTijdstip(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500 text-slate-800 font-medium"
                />
                <p className="text-[10px] text-slate-400 italic">Pas dit aan als de meting feitelijk op een ander moment is uitgevoerd.</p>
              </div>

              {/* 2. CORRECTIE VAN DE WAARDE */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">📝 Nieuwe Waarde</label>

                {/* Dynamisch invoerveld op basis van datatype van de te corrigeren meting */}
                {editingMeting.dataType === "textarea" ? (
                  <textarea
                    value={correctieWaarde}
                    onChange={(e) => setCorrectieWaarde(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y"
                  />
                ) : editingMeting.dataType === "numeriek" ? (
                  <input
                    type="number"
                    step="any"
                    value={correctieWaarde}
                    onChange={(e) => setCorrectieWaarde(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500"
                  />
                ) : editingMeting.dataType === "datum" ? (
                  <input
                    type="datetime-local"
                    value={correctieWaarde}
                    onChange={(e) => setCorrectieWaarde(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={correctieWaarde}
                    onChange={(e) => setCorrectieWaarde(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-10 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              {correctieFeedback && (
                <div className={`p-2.5 rounded text-xs font-semibold ${correctieFeedback.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  {correctieFeedback.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMeting(null)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleSaveCorrectie}
                  disabled={isCorrecting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                >
                  {isCorrecting ? "Opslaan..." : "Correctie Opslaan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}