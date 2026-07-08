"use client";

import { useRef, useTransition, useState, useEffect } from "react";
import { createObjectAction, updateObjectAction, getObjectHierarchie, getObjecten, updateRelatieVolgordeAction, terminateRelatieAction } from "@/app/actions/objecten";

interface ObjectType { id: string; omschrijving: string; }
interface SysteemObject { id: string; type: string; weergaveNaam: string; createdAt: string; }

interface Props {
    objectTypen: ObjectType[];
    initialObjecten: SysteemObject[];
}

export default function ObjectenLijstEnForm({ objectTypen, initialObjecten }: Props) {
    const formRef = useRef<HTMLFormElement>(null);
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

    // State voor selectie & bewerken
    const [selectedObject, setSelectedObject] = useState<SysteemObject | null>(null);
    const [hierarchie, setHierarchie] = useState<{ ouders: any[]; kinderen: any[] }>({ ouders: [], kinderen: [] });
    // Dynamische lijst die reageert op filters
    const [filteredObjecten, setFilteredObjecten] = useState<SysteemObject[]>(initialObjecten);
    const [zoekterm, setZoekterm] = useState("");
    const [filterType, setFilterType] = useState("");

    // Update de lijst als de initiële data van de server verandert (bijv. na toevoegen/bewerken)
    useEffect(() => {
        setFilteredObjecten(initialObjecten);
    }, [initialObjecten]);

    // Effect dat de database triggert bij filterwijzigingen
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            // Roep de server action direct aan met de actuele filters
            const data = await getObjecten({ type: filterType, zoekterm: zoekterm });
            setFilteredObjecten(data);
        }, 250); // Debounce van 250ms om Turso te sparen tijdens het typen

        return () => clearTimeout(delayDebounceFn);
    }, [zoekterm, filterType]);
    // Haal hiërarchie op zodra er een object geselecteerd wordt
    useEffect(() => {
        if (selectedObject) {
            getObjectHierarchie(selectedObject.id).then(setHierarchie);
        } else {
            setHierarchie({ ouders: [], kinderen: [] });
        }
    }, [selectedObject, initialObjecten]); // Herlaad ook als de lijst (na mutatie) verandert

    const handleSubmit = (formData: FormData) => {
        setFeedback(null);
        startTransition(async () => {
            let res;
            if (selectedObject) {
                // Edit mode
                res = await updateObjectAction(selectedObject.id, formData);
                if (res.success) {
                    setSelectedObject({
                        ...selectedObject,
                        weergaveNaam: formData.get("weergaveNaam") as string,
                        type: formData.get("type") as string
                    });
                }
            } else {
                // Create mode
                res = await createObjectAction(formData);
                if (res.success) formRef.current?.reset();
            }
            setFeedback(res);
        });
    };

    return (
        <div className="space-y-6">

            {/* 1. DYNAMISCH FORMULIER (Aanmaken óf Aanpassen) */}
            <div className={`border rounded-xl p-4 sm:p-5 transition-colors ${selectedObject ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base font-bold text-slate-900">
                        {selectedObject ? `Object Aanpassen: ${selectedObject.weergaveNaam}` : "Nieuw Object Registreren"}
                    </h3>
                    {selectedObject && (
                        <button
                            onClick={() => { setSelectedObject(null); setFeedback(null); formRef.current?.reset(); }}
                            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded"
                        >
                            Annuleer Bewerken
                        </button>
                    )}
                </div>

                {/* We gebruiken key={selectedObject?.id} om het formulier te forceren te resetten/vullen bij selectiewissel */}
                <form ref={formRef} key={selectedObject?.id} action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
                    <div>
                        <label htmlFor="type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                            Objecttype
                        </label>
                        <select
                            id="type"
                            name="type"
                            required
                            defaultValue={selectedObject?.type || ""}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10"
                        >
                            <option value="">-- Kies een type --</option>
                            {objectTypen.map((t) => (
                                <option key={t.id} value={t.id}>{t.omschrijving}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="weergaveNaam" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                            Weergavenaam / Label
                        </label>
                        <input
                            id="weergaveNaam"
                            type="text"
                            name="weergaveNaam"
                            required
                            defaultValue={selectedObject?.weergaveNaam || ""}
                            placeholder="Bijv: Kast A"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10"
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isPending}
                            className={`w-full text-white font-medium text-sm rounded-lg h-10 transition-colors disabled:bg-slate-400 ${selectedObject ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}
                        >
                            {isPending ? "Opslaan..." : selectedObject ? "Wijzigingen Opslaan" : "Object Toevoegen"}
                        </button>
                    </div>
                </form>

                {feedback && (
                    <div className={`mt-3 p-3 rounded-lg text-xs font-medium ${feedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {feedback.message}
                    </div>
                )}
            </div>

            {/* 2. CONTEXTUELE NETWERK-VIEW (Alleen zichtbaar bij selectie) */}
            {selectedObject && (
                <div className="bg-slate-900 text-slate-100 rounded-xl p-4 sm:p-5 shadow-inner space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400">Netwerk Context Relaties</h4>

                    <div className="flex flex-col items-center space-y-2 text-sm text-center">
                        {/* OUDERS */}
                        <div className="w-full max-w-md bg-slate-800 rounded-lg p-2 border border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-mono uppercase">Ouder Relatie(s)</span>
                            {hierarchie.ouders.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-1">Geen fysieke ouders (Top-level)</p>
                            ) : (
                                hierarchie.ouders.map((o) => (
                                    <div key={o.relatieId} className="text-xs py-1 text-slate-300">
                                        <span className="font-bold text-white">{o.ouderNa5m}</span> ({o.ouderType})
                                        <span className="text-blue-400 block text-[10px]">↳ {o.relatieType} (volgorde: {o.volgorde})</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* HET OBJECT ZELF */}
                        <div className="w-5 h-5 flex items-center justify-center text-blue-400">↓</div>
                        <div className="w-full max-w-md bg-blue-600 text-white rounded-lg p-2 font-bold shadow-md border border-blue-400">
                            {selectedObject.weergaveNaam}
                            <span className="text-[10px] opacity-75 block font-mono font-normal">FOCUS OBJECT ({selectedObject.type})</span>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center text-blue-400">↓</div>

                        {/* KINDEREN */}
                        <div className="w-full max-w-md bg-slate-800 rounded-lg p-2 border border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-mono uppercase">Kind Relatie(s) (op volgorde)</span>
                            {hierarchie.kinderen.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-1">Geen kinderen (Leaf-node)</p>
                            ) : (
                                <div className="divide-y divide-slate-700">
                                    {hierarchie.kinderen.map((k) => (
                                        <div key={k.relatieId} className="text-xs py-2 text-slate-300 flex justify-between items-center gap-4 border-b border-slate-800 last:border-0">
                                            <div className="text-left flex-1">
                                                <span className="font-bold text-white">{k.kindNaam}</span> ({k.kindType})
                                                <span className="text-slate-400 block text-[10px]">↳ {k.relatieType}</span>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                {/* Volgorde Manipulatie */}
                                                <div className="flex items-center space-x-1 bg-slate-700 p-1 rounded">
                                                    <button
                                                        onClick={async () => {
                                                            await updateRelatieVolgordeAction(k.relatieId, k.volgorde - 1);
                                                            getObjectHierarchie(selectedObject.id).then(setHierarchie);
                                                        }}
                                                        className="hover:bg-slate-600 text-blue-400 px-1 rounded font-bold text-[10px]"
                                                    >
                                                        ▲
                                                    </button>
                                                    <span className="px-1 font-mono text-[11px] text-white font-bold min-w-4 text-center">{k.volgorde}</span>
                                                    <button
                                                        onClick={async () => {
                                                            await updateRelatieVolgordeAction(k.relatieId, k.volgorde + 1);
                                                            getObjectHierarchie(selectedObject.id).then(setHierarchie);
                                                        }}
                                                        className="hover:bg-slate-600 text-blue-400 px-1 rounded font-bold text-[10px]"
                                                    >
                                                        ▼
                                                    </button>
                                                </div>

                                                {/* ONTCOPPEL KNOP (Zet validUntil op NU) */}
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Weet je zeker dat je de relatie met ${k.kindNaam} wilt verbreken?`)) {
                                                            await terminateRelatieAction(k.relatieId);
                                                            // Ververs de lijst direct
                                                            getObjectHierarchie(selectedObject.id).then(setHierarchie);
                                                        }
                                                    }}
                                                    className="bg-red-950/50 hover:bg-red-900 border border-red-800 text-red-400 p-1.5 rounded text-[10px] font-bold transition-colors"
                                                    title="Relatie beëindigen"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. LIST VIEW */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
                    <h3 className="text-base font-bold text-slate-900">
                        Geregistreerde Objecten <span className="text-xs font-normal text-slate-500">(Toont top 20)</span>
                    </h3>
                </div>

                {/* HET FILTER VENSTER (Compact voor mobiel) */}
                <div className="bg-slate-100 p-3 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                        <label htmlFor="filter_zoek" className="block text-xs font-medium text-slate-600 mb-1">Zoeken op naam</label>
                        <input
                            id="filter_zoek"
                            type="text"
                            placeholder="Typ om te filteren..."
                            value={zoekterm}
                            onChange={(e) => setZoekterm(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="filter_type" className="block text-xs font-medium text-slate-600 mb-1">Filter op Type</label>
                        <select
                            id="filter_type"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                        >
                            <option value="">-- Alle typen --</option>
                            {objectTypen.map((t) => (
                                <option key={t.id} value={t.id}>{t.omschrijving}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Verander hier initialObjecten.length naar filteredObjecten.length */}
                {filteredObjecten.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Geen objecten gevonden die voldoen aan de filters.</p>
                ) : (
                    <>
                        {/* Desktop Tabel - Pas initialObjecten.map aan naar filteredObjecten.map */}
                        <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                                <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Weergavenaam</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">ID</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-slate-600">
                                    {filteredObjecten.map((obj) => {
                                        const isSelected = selectedObject?.id === obj.id;
                                        return (
                                            <tr
                                                key={obj.id}
                                                onClick={() => setSelectedObject(obj)}
                                                className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50 hover:bg-blue-100 font-medium" : "hover:bg-slate-50"}`}
                                            >
                                                <td className={`px-4 py-3 ${isSelected ? "text-blue-700 font-bold" : "text-slate-900"}`}>{obj.weergaveNaam}</td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{obj.type}</span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{obj.id.slice(0, 8)}...</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobiel - Pas ook hier initialObjecten.map aan naar filteredObjecten.map */}
                        <div className="sm:hidden space-y-3">
                            {filteredObjecten.map((obj) => {
                                const isSelected = selectedObject?.id === obj.id;
                                return (
                                    <div
                                        key={obj.id}
                                        onClick={() => setSelectedObject(obj)}
                                        className={`border rounded-xl p-4 space-y-2 cursor-pointer active:scale-[0.99] transition-transform ${isSelected ? "bg-blue-50 border-blue-400" : "bg-slate-50 border-slate-200"}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <h4 className={`font-bold ${isSelected ? "text-blue-700" : "text-slate-900"}`}>{obj.weergaveNaam}</h4>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{obj.type}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

        </div>
    );
}