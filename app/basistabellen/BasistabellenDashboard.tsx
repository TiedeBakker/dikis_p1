export const dynamic = "force-dynamic";
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { getBasistabellenData, createBasistabelItemAction, updateBasistabelItemAction } from "@/app/actions/basistabellen";
import { getFormulierConfiguratieAction, saveFormulierConfiguratieAction } from "@/app/actions/metadata";
import { MoveUp, MoveDown, Plus, Trash2, Save, Loader2 } from "lucide-react";

interface ParameterDefinitie {
  id: string; // Of pas aan naar string | null als je dat expliciet wilt toestaan
  naam: string;
  dataType: string;
}

interface Props {
  initialData: { typen: any[]; relaties: any[]; meeteenheden: any[]; };
  alleParameters: ParameterDefinitie[];
}

interface SelectedItem {
  tabel: "object" | "relatie" | "eenheid";
  id: string;
  omschrijving: string;
  symbool?: string;
  toelichting?: string;
}

export default function BasistabellenDashboard({ initialData, alleParameters = [] }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [zoekterm, setZoekterm] = useState("");
  const [actieveTabel, setActieveTabel] = useState<"object" | "relatie" | "eenheid">("object");
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  // States voor formulier-indeling metadata (Fase 1)
  const [actieveParameters, setActieveParameters] = useState<ParameterDefinitie[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => { setData(initialData); }, [initialData]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const gefilterd = await getBasistabellenData(zoekterm);
      setData(gefilterd);
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [zoekterm]);

  // Laad de gekoppelde parameters in wanneer een Objecttype geselecteerd wordt
  useEffect(() => {
    if (selectedItem && selectedItem.tabel === "object") {
      const laadConfiguratie = async () => {
        setLoadingConfig(true);
        const result = await getFormulierConfiguratieAction(selectedItem.id);
        if (result.success && result.data) {
          const geordendeParams = result.data
            .filter(item => item.parameterId !== null) // Filter eventuele null-waarden er direct uit
            .map(item => ({
              id: item.parameterId as string, // Cast veilig naar string na de filter
              naam: item.parameterNaam,
              dataType: item.dataType
            }));
          setActieveParameters(geordendeParams);
        } else {
          setActieveParameters([]);
        }
        setLoadingConfig(false);
      };
      laadConfiguratie();
    } else {
      setActieveParameters([]);
    }
  }, [selectedItem]);

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

  // Metadata beheer functies
  const voegParameterToe = (param: ParameterDefinitie) => {
    if (actieveParameters.some(p => p.id === param.id)) return;
    setActieveParameters([...actieveParameters, param]);
  };

  const verwijderParameter = (paramId: string) => {
    setActieveParameters(actieveParameters.filter(p => p.id !== paramId));
  };

  const verschuifParameter = (index: number, richting: "omhoog" | "omlaag") => {
    const nieuweLijst = [...actieveParameters];
    const doelIndex = richting === "omhoog" ? index - 1 : index + 1;
    if (doelIndex < 0 || doelIndex >= nieuweLijst.length) return;

    const temp = nieuweLijst[index];
    nieuweLijst[index] = nieuweLijst[doelIndex];
    nieuweLijst[doelIndex] = temp;
    setActieveParameters(nieuweLijst);
  };

  const handleOpslaanConfiguratie = async () => {
    if (!selectedItem || selectedItem.tabel !== "object") return;
    setSavingConfig(true);
    const payload = actieveParameters.map((p, index) => ({
      parameterId: p.id,
      volgorde: index + 1,
    }));

    const result = await saveFormulierConfiguratieAction(selectedItem.id, payload);
    if (result.success) {
      alert("Formulierindeling succesvol opgeslagen!");
    } else {
      alert("Fout bij opslaan: " + result.error);
    }
    setSavingConfig(false);
  };

  // Filter beschikbare parameters (alles minus wat al actief is)
  const beschikbareParameters = alleParameters.filter(
    (p) => !actieveParameters.some((ap) => ap.id === p.id)
  );

  return (
    <div className="space-y-6">
      {/* 1. LIVE FILTER BALK */}
      <div className="bg-slate-100 p-3 rounded-xl">
        <input
          type="text"
          placeholder="🔎 Typ om direct te zoeken in álle basistabellen..."
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

          {/* TEXTAREA VOOR OBJECT- EN RELATIETYPEN */}
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

        {/* ==========================================
            FASE 1: FORMULIERINRICHTING METADATA
            ========================================== */}
        {selectedItem && selectedItem.tabel === "object" && (
          <div className="mt-6 pt-6 border-t border-amber-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Formulier-kenmerken voor dit objecttype
                </h4>
                <p className="text-xs text-slate-500">
                  Selecteer welke parameters getoond moeten worden bij het bewerken van een {selectedItem.omschrijving}.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpslaanConfiguratie}
                disabled={savingConfig}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {savingConfig ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Indeling Opslaan
              </button>
            </div>

            {loadingConfig ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Beschikbaar */}
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <h5 className="text-[11px] font-bold text-slate-600 uppercase mb-2">
                    Beschikbare Kenmerken ({beschikbareParameters.length})
                  </h5>
                  {beschikbareParameters.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Geen overige kenmerken.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {beschikbareParameters.map((param) => (
                        <div
                          key={param.id}
                          onClick={() => voegParameterToe(param)}
                          className="flex items-center justify-between p-2 rounded text-xs border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 cursor-pointer transition-all"
                        >
                          <div>
                            <p className="font-semibold text-slate-700">{param.naam}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{param.dataType}</p>
                          </div>
                          <Plus className="h-4 w-4 text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actief in formulier */}
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <h5 className="text-[11px] font-bold text-slate-600 uppercase mb-2">
                    Actief in formulier ({actieveParameters.length})
                  </h5>
                  {actieveParameters.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Er zijn nog geen specifieke kenmerken gekoppeld.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {actieveParameters.map((param, index) => (
                        <div
                          key={param.id}
                          className="flex items-center justify-between p-1.5 rounded text-xs border border-slate-100 bg-slate-50/50"
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => verschuifParameter(index, "omhoog")}
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <MoveUp className="h-3 w-3 text-slate-600" />
                            </button>
                            <button
                              type="button"
                              disabled={index === actieveParameters.length - 1}
                              onClick={() => verschuifParameter(index, "omlaag")}
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <MoveDown className="h-3 w-3 text-slate-600" />
                            </button>
                            <div className="ml-1">
                              <p className="font-semibold text-slate-700">{param.naam}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{param.dataType}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => verwijderParameter(param.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. DRIE KOLOMMEN OVERZICHT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* KOLOM 1: OBJECT TYPEN */}
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-sm text-slate-900">📂 Object Typen</h4>
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

        {/* KOLOM 3: MEETWEENHEDEN */}
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