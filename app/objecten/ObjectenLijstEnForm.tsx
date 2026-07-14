// app/objecten/ObjectenLijstEnForm.tsx
"use client";

import { useRef, useTransition, useState, useEffect } from "react";
import {
    createObjectAction,
    updateObjectAction,
    getObjectHierarchie,
    getObjecten,
    updateRelatieVolgordeAction,
    terminateRelatieAction,
    updateRelatieDetailsAction // <-- NIEUW
} from "@/app/actions/objecten";

import NetworkHoverCard from "@/components/NetworkHoverCard";
import { getWaarnemingenHistorie } from "@/app/actions/waarnemingen";
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

    // NIEUW: State voor het bewerken van een specifieke relatie via Double Click
    const [editingRelatie, setEditingRelatie] = useState<any | null>(null);

    // Dynamische lijst die reageert op filters
    const [filteredObjecten, setFilteredObjecten] = useState<SysteemObject[]>(initialObjecten);
    const [zoekterm, setZoekterm] = useState("");
    const [filterType, setFilterType] = useState("");

    useEffect(() => {
        setFilteredObjecten(initialObjecten);
    }, [initialObjecten]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            const data = await getObjecten({ type: filterType, zoekterm: zoekterm });
            setFilteredObjecten(data);
        }, 250);
        return () => clearTimeout(delayDebounceFn);
    }, [zoekterm, filterType]);

    useEffect(() => {
        if (selectedObject) {
            getObjectHierarchie(selectedObject.id).then(setHierarchie);
        } else {
            setHierarchie({ ouders: [], kinderen: [] });
        }
        setEditingRelatie(null); // Reset edit view bij objectwissel
    }, [selectedObject, initialObjecten]);

    const handleSubmit = (formData: FormData) => {
        setFeedback(null);
        startTransition(async () => {
            let res;
            if (selectedObject) {
                res = await updateObjectAction(selectedObject.id, formData);
                if (res.success) {
                    setSelectedObject({
                        ...selectedObject,
                        weergaveNaam: formData.get("weergaveNaam") as string,
                        type: formData.get("type") as string
                    });
                }
            } else {
                res = await createObjectAction(formData);
                if (res.success) formRef.current?.reset();
            }
            setFeedback(res);
        });
    };

    // NIEUW: Handler voor opslaan relatie-wijzigingen
    const handleRelatieSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingRelatie) return;

        const formData = new FormData(e.currentTarget);
        const res = await updateRelatieDetailsAction(editingRelatie.relatieId, formData);

        if (res.success) {
            setEditingRelatie(null);
            // Refresh de netwerklijst direct
            if (selectedObject) {
                getObjectHierarchie(selectedObject.id).then(setHierarchie);
            }
        } else {
            alert(res.message);
        }
    };

    // Helper om ISO string om te zetten naar datetime-local compatibel formaat (YYYY-MM-DDTHH:MM)
    const formatToDatetimeLocal = (isoString?: string) => {
        if (!isoString) return "";
        const d = new Date(isoString);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    // --- DRAWER (Zijbalk) STATE ---
    const [drawerObject, setDrawerObject] = useState<SysteemObject | null>(null);
    const [drawerHistorie, setDrawerHistorie] = useState<any[]>([]);
    const [loadingDrawer, setLoadingDrawer] = useState(false);

    // Laad de historie zodra er een object in de drawer geopend wordt
    useEffect(() => {
        if (drawerObject) {
            setLoadingDrawer(true);
            // We hergebruiken je getWaarnemingenHistorie action
            getWaarnemingenHistorie(drawerObject.id).then((data) => {
                setDrawerHistorie(data);
                setLoadingDrawer(false);
            });
        } else {
            setDrawerHistorie([]);
        }
    }, [drawerObject]);

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

                <form ref={formRef} key={selectedObject?.id} action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
                    <div>
                        <label htmlFor="type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Objecttype</label>
                        <select id="type" name="type" required defaultValue={selectedObject?.type || ""} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10">
                            <option value="">-- Kies een type --</option>
                            {objectTypen.map((t) => (<option key={t.id} value={t.id}>{t.omschrijving}</option>))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="weergaveNaam" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Weergavenaam / Label</label>
                        <input id="weergaveNaam" type="text" name="weergaveNaam" required defaultValue={selectedObject?.weergaveNaam || ""} placeholder="Bijv: Kast A" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10" />
                    </div>
                    <div>
                        <button type="submit" disabled={isPending} className={`w-full text-white font-medium text-sm rounded-lg h-10 transition-colors disabled:bg-slate-400 ${selectedObject ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                            {isPending ? "Opslaan..." : selectedObject ? "Wijzigingen Opslaan" : "Object Toevoegen"}
                        </button>
                    </div>
                </form>
                {feedback && <div className={`mt-3 p-3 rounded-lg text-xs font-medium ${feedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{feedback.message}</div>}
            </div>

            {/* 2. CONTEXTUELE NETWERK-VIEW (Alleen zichtbaar bij selectie) */}
            {selectedObject && (
                <div className="bg-slate-900 text-slate-100 rounded-xl p-4 sm:p-5 shadow-inner space-y-4 relative">
                    <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400">Netwerk Context Relaties</h4>
                        <span className="text-[10px] text-slate-400 italic">Dubbelklik op een relatie om metadata/toelichting te wijzigen</span>
                    </div>

                    {/* INTERNE MODAL OVERLAY VOOR BEWERKEN VAN EEN RELATIE */}
                    {editingRelatie && (
                        <div className="absolute inset-0 bg-slate-950/90 rounded-xl p-5 z-10 flex flex-col justify-center items-center">
                            <form onSubmit={handleRelatieSubmit} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-4 shadow-xl text-slate-200">
                                <h5 className="text-sm font-bold text-blue-400 border-b border-slate-700 pb-2">
                                    Relatie Aanpassen ({editingRelatie.relatieType})
                                </h5>
                                <p className="text-[11px] text-slate-400">
                                    Tussen <strong>{editingRelatie.ouderNaam || selectedObject.weergaveNaam}</strong> en <strong>{editingRelatie.kindNaam || selectedObject.weergaveNaam}</strong>
                                </p>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <label className="block text-slate-400 mb-1 font-mono uppercase text-[9px]">Geldig Vanaf (createdAt)</label>
                                        <input type="datetime-local" name="createdAt" required defaultValue={formatToDatetimeLocal(editingRelatie.createdAt)} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 mb-1 font-mono uppercase text-[9px]">Geldig Tot (validUntil)</label>
                                        <input type="datetime-local" name="validUntil" defaultValue={formatToDatetimeLocal(editingRelatie.validUntil)} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white focus:outline-none focus:border-blue-500" />
                                    </div>
                                </div>

                                <div className="text-xs">
                                    <label className="block text-slate-400 mb-1 font-mono uppercase text-[9px]">Toelichting / Opmerking</label>
                                    <textarea name="toelichting" rows={3} defaultValue={editingRelatie.toelichting || ""} placeholder="Bijv: Tijdelijk geplaatst wegens revisie..." className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs focus:outline-none focus:border-blue-500 resize-none" />
                                </div>

                                <div className="flex justify-end space-x-2 text-xs pt-2 border-t border-slate-700">
                                    <button type="button" onClick={() => setEditingRelatie(null)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">Annuleren</button>
                                    <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded">Opslaan</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="flex flex-col items-center space-y-2 text-sm text-center">
                        {/* ==================== OUDERS ==================== */}
                        <div className="w-full max-w-md bg-slate-800 rounded-lg p-2 border border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-mono uppercase">Ouder Relatie(s)</span>
                            {hierarchie.ouders.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-1">Geen fysieke ouders (Top-level)</p>
                            ) : (
                                hierarchie.ouders.map((o) => (
                                    <div
                                        key={o.relatieId}
                                        onDoubleClick={() => setEditingRelatie(o)}
                                        className="text-xs py-1.5 text-slate-300 cursor-pointer hover:bg-slate-700/50 rounded px-1 transition-colors select-none group"
                                        title="Dubbelklik om te bewerken"
                                    >
                                        {/* GEÏNTEGREERD: Hover over de ouder voor live meetwaarden */}
                                        <NetworkHoverCard
                                            objectId={o.vanObjectId || o.ouderId} // Afhankelijk van de key in je hierarchie-object (id van de ouder)
                                            objectNaam={o.ouderNaam}
                                            objectType={o.ouderType}
                                        >
                                            <span className="font-bold text-white group-hover:text-blue-400 underline decoration-dotted decoration-slate-500 hover:decoration-blue-400">
                                                {o.ouderNaam}
                                            </span>
                                        </NetworkHoverCard>

                                        <span className="text-slate-400"> ({o.ouderType})</span>
                                        <span className="text-blue-400 block text-[10px]">↳ {o.relatieType} (volgorde: {o.volgorde})</span>
                                        {o.toelichting && <span className="block text-[10px] text-amber-400 italic font-mono">“{o.toelichting}”</span>}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* HET OBJECT ZELF
<div className="w-5 h-5 flex items-center justify-center text-blue-400">↓</div>
<div className="w-full max-w-md bg-blue-600 text-white rounded-lg p-2 font-bold shadow-md border border-blue-400">
    {selectedObject.weergaveNaam}
    <span className="text-[10px] opacity-75 block font-mono font-normal">FOCUS OBJECT ({selectedObject.type})</span>
</div>
<div className="w-5 h-5 flex items-center justify-center text-blue-400">↓</div> */}

                        {/* ==================== HET OBJECT ZELF ==================== */}
                        <div className="w-5 h-5 flex items-center justify-center text-blue-400">↓</div>

                        {/* GEÏNTEGREERD: Hover over het focus object voor de live meetwaarden */}
                        <NetworkHoverCard
                            objectId={selectedObject.id}
                            objectNaam={selectedObject.weergaveNaam}
                            objectType={selectedObject.type}
                        >
                            <div className="w-full max-w-md bg-blue-600 text-white rounded-lg p-2 font-bold shadow-md border border-blue-400 cursor-pointer hover:bg-blue-500 hover:scale-[1.02] transition-all select-none text-center">
                                <span className="underline decoration-dotted decoration-blue-300 hover:decoration-white">
                                    {selectedObject.weergaveNaam}
                                </span>
                                <span className="text-[10px] opacity-75 block font-mono font-normal">FOCUS OBJECT ({selectedObject.type})</span>
                            </div>
                        </NetworkHoverCard>

                        <div className="w-5 h-5 flex items-center justify-center text-blue-400">↓</div>

                        {/* ==================== KINDEREN ==================== */}
                        <div className="w-full max-w-md bg-slate-800 rounded-lg p-2 border border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-mono uppercase">Kind Relatie(s) (op volgorde)</span>
                            {hierarchie.kinderen.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-1">Geen kinderen (Leaf-node)</p>
                            ) : (
                                <div className="divide-y divide-slate-700">
                                    {hierarchie.kinderen.map((k) => (
                                        <div
                                            key={k.relatieId}
                                            onDoubleClick={() => setEditingRelatie(k)}
                                            className="text-xs py-2 text-slate-300 flex justify-between items-center gap-4 border-b border-slate-800 last:border-0 cursor-pointer hover:bg-slate-700/50 rounded px-1 transition-colors select-none group"
                                            title="Dubbelklik om te bewerken"
                                        >
                                            <div className="text-left flex-1">
                                                {/* GEÏNTEGREERD: Hover over het kind voor live meetwaarden */}
                                                <NetworkHoverCard
                                                    objectId={k.naarObjectId || k.kindId} // Afhankelijk van de key in je hierarchie-object (id van het kind)
                                                    objectNaam={k.kindNaam}
                                                    objectType={k.kindType}
                                                >
                                                    <span className="font-bold text-white group-hover:text-blue-400 underline decoration-dotted decoration-slate-500 hover:decoration-blue-400">
                                                        {k.kindNaam}
                                                    </span>
                                                </NetworkHoverCard>

                                                <span className="text-slate-400"> ({k.kindType})</span>
                                                <span className="text-slate-400 block text-[10px]">↳ {k.relatieType}</span>
                                                {k.toelichting && <span className="block text-[10px] text-amber-400 italic font-mono">“{k.toelichting}”</span>}
                                            </div>

                                            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center space-x-1 bg-slate-700 p-1 rounded">
                                                    <button onClick={async () => { await updateRelatieVolgordeAction(k.relatieId, k.volgorde - 1); getObjectHierarchie(selectedObject.id).then(setHierarchie); }} className="hover:bg-slate-600 text-blue-400 px-1 rounded font-bold text-[10px]">▲</button>
                                                    <span className="px-1 font-mono text-[11px] text-white font-bold min-w-4 text-center">{k.volgorde}</span>
                                                    <button onClick={async () => { await updateRelatieVolgordeAction(k.relatieId, k.volgorde + 1); getObjectHierarchie(selectedObject.id).then(setHierarchie); }} className="hover:bg-slate-600 text-blue-400 px-1 rounded font-bold text-[10px]">▼</button>
                                                </div>
                                                <button onClick={async () => { if (confirm(`Weet je zeker dat je de relatie met ${k.kindNaam} wilt verbreken?`)) { await terminateRelatieAction(k.relatieId); getObjectHierarchie(selectedObject.id).then(setHierarchie); } }} className="bg-red-950/50 hover:bg-red-900 border border-red-800 text-red-400 p-1.5 rounded text-[10px] font-bold transition-colors" title="Relatie beëindigen">✕</button>
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
                    <h3 className="text-base font-bold text-slate-900">Geregistreerde Objecten <span className="text-xs font-normal text-slate-500">(Toont top 20)</span></h3>
                </div>

                <div className="bg-slate-100 p-3 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                        <label htmlFor="filter_zoek" className="block text-xs font-medium text-slate-600 mb-1">Zoeken op naam</label>
                        <input id="filter_zoek" type="text" placeholder="Typ om te filteren..." value={zoekterm} onChange={(e) => setZoekterm(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="filter_type" className="block text-xs font-medium text-slate-600 mb-1">Filter op Type</label>
                        <select id="filter_type" value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500">
                            <option value="">-- Alle typen --</option>
                            {objectTypen.map((t) => (<option key={t.id} value={t.id}>{t.omschrijving}</option>))}
                        </select>
                    </div>
                </div>

                {filteredObjecten.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Geen objecten gevonden die voldoen aan de filters.</p>
                ) : (
                    <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Weergavenaam</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3 text-right">Acties</th></tr>
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
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {obj.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{obj.id.slice(0, 8)}...</td>

                                            {/* ACTIECELL MET DE DETAILS-TRIGGER */}
                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => setDrawerObject(obj)}
                                                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                                                    title="Toon uitgebreide details en historie"
                                                >
                                                    📊 Details
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {/* ==================== ZIJSCHIRM / CONTEXT DRAWER ==================== */}
            {/* Overlay achtergrond */}
            <div
                className={`fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${drawerObject ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={() => setDrawerObject(null)}
            />

            {/* De daadwerkelijke lade (Drawer) */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out transform border-l border-slate-200 flex flex-col ${drawerObject ? "translate-x-0" : "translate-x-full"}`}
            >
                {drawerObject && (
                    <>
                        {/* Header van de Drawer */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider font-mono">{drawerObject.type}</span>
                                <h4 className="text-base font-bold text-slate-900">{drawerObject.weergaveNaam}</h4>
                            </div>
                            <button
                                onClick={() => setDrawerObject(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Inhoud van de Drawer (scrollbaar) */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">

                            {/* Sectie 1: Systeeminformatie */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Object Metadata</h5>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Uniek ID:</span>
                                        <span className="font-mono text-slate-800 select-all">{drawerObject.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Geregistreerd op:</span>
                                        <span className="text-slate-800">
                                            {new Date(drawerObject.createdAt).toLocaleDateString("nl-NL", {
                                                day: "2-digit",
                                                month: "long",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Sectie 2: Recente Tijdlijn / Meetwaarden Historie */}
                            <div className="space-y-3">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Recente Meetwaarden & Wijzigingen</h5>

                                {loadingDrawer ? (
                                    <div className="py-8 text-center text-xs text-slate-400 italic">
                                        Geschiedenis laden...
                                    </div>
                                ) : drawerHistorie.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed">
                                        Nog geen historische waarnemingen geregistreerd voor dit object.
                                    </div>
                                ) : (
                                    <div className="flow-root">
                                        <ul className="-mb-8">
                                            {drawerHistorie.slice(0, 15).map((meting, index) => (
                                                <li key={meting.id}>
                                                    <div className="relative pb-8">
                                                        {/* Lijn tussen de tijdlijnpunten */}
                                                        {index !== drawerHistorie.length - 1 && (
                                                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                                                        )}
                                                        <div className="relative flex space-x-3">
                                                            <div>
                                                                {/* Bolletje */}
                                                                <span className="h-8 w-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs">
                                                                    📊
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 min-w-0 pt-1.5">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <p className="text-xs font-semibold text-slate-800 truncate">
                                                                        {meting.parameterNaam}
                                                                    </p>
                                                                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                                        {meting.waarde}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                                    {new Date(meting.tijdstipUtc).toLocaleDateString("nl-NL", {
                                                                        day: "2-digit",
                                                                        month: "short",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit"
                                                                    })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer van de Drawer met snelkoppelingen of acties */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    // Snelkoppeling om dit direct te selecteren voor bewerken of relatiebeheer
                                    setSelectedObject(drawerObject);
                                    setDrawerObject(null);
                                }}
                                className="w-full bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold py-2 px-3 rounded-lg transition-colors text-center"
                            >
                                Selecteer in Netwerk Context
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}