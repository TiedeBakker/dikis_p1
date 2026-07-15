// app/objecten/ObjectenBoomNavigator.tsx
"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { getObjecten, updateObjectAction, getBoomNavigatorData } from "@/app/actions/objecten";
import { getWaarnemingenHistorie } from "@/app/actions/waarnemingen";

interface Props {
    objectTypen: any[];
    relatieTypen: any[];
}

export default function ObjectenBoomNavigator({ objectTypen, relatieTypen }: Props) {
    const [isPending, startTransition] = useTransition();
    const [selectedObjectId, setSelectedObjectId] = useState<string>("");
    const [boomData, setBoomData] = useState<any | null>(null);

    // Zoeken naar startobject
    const [zoekterm, setZoekterm] = useState("");
    const [zoekResultaten, setZoekResultaten] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Drawer (zijpaneel) voor details & metingen
    const [drawerObject, setDrawerObject] = useState<any | null>(null);
    const [drawerHistorie, setDrawerHistorie] = useState<any[]>([]);
    const [loadingDrawer, setLoadingDrawer] = useState(false);

    // Edit-modal voor centrale object
    const [isEditingCentral, setIsEditingCentral] = useState(false);
    const [editFeedback, setEditFeedback] = useState<{ success: boolean; message: string } | null>(null);

    // Sluit zoekdropdown bij klik buiten
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Effect voor live zoeken (met lichte debounce)
    useEffect(() => {
        if (!zoekterm) {
            setZoekResultaten([]);
            return;
        }
        const delayDebounce = setTimeout(async () => {
            const resulten = await getObjecten({ zoekterm });
            setZoekResultaten(resulten);
        }, 200);

        return () => clearTimeout(delayDebounce);
    }, [zoekterm]);

    // Boom-data ophalen bij verandering van centraal object
    useEffect(() => {
        if (!selectedObjectId) {
            setBoomData(null);
            return;
        }
        startTransition(async () => {
            const data = await getBoomNavigatorData(selectedObjectId);
            setBoomData(data);
        });
    }, [selectedObjectId]);

    // Waarnemingen ophalen als een object in de drawer geopend wordt
    useEffect(() => {
        if (drawerObject) {
            setLoadingDrawer(true);
            getWaarnemingenHistorie(drawerObject.id).then((historie) => {
                setDrawerHistorie(historie);
                setLoadingDrawer(false);
            });
        } else {
            setDrawerHistorie([]);
        }
    }, [drawerObject]);

    // Wijzigingen opslaan van centraal object
    const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!boomData?.centraal) return;

        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await updateObjectAction(boomData.centraal.id, formData);
            setEditFeedback(res);
            if (res.success) {
                setIsEditingCentral(false);
                setEditFeedback(null);
                // Refresh de boom
                const updated = await getBoomNavigatorData(selectedObjectId);
                setBoomData(updated);
            }
        });
    };

    // Recursieve component om voorouders/ouders netjes boven elkaar te renderen
    function ParentBranch({ node }: { node: any }) {
        return (
            <div className="flex flex-col items-center flex-1 min-w-[130px]">
                {/* Render oudere generaties daarboven */}
                {node.ouders && node.ouders.length > 0 && (
                    <div className="flex gap-4 justify-center w-full mb-3 pb-2 border-b border-dashed border-slate-200">
                        {node.ouders.map((p: any) => (
                            <ParentBranch key={p.id} node={p} />
                        ))}
                    </div>
                )}

                {/* De ouder-node zelf */}
                <div
                    onClick={() => setDrawerObject(node)}
                    onDoubleClick={() => setSelectedObjectId(node.id)}
                    className="cursor-pointer p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-slate-50 rounded-lg text-center shadow-sm transition select-none max-w-[160px] w-full"
                    title="Klik voor historie | Dubbelklik om centraal te maken"
                >
                    <div className="text-[9px] text-blue-500 font-bold mb-1 uppercase tracking-wider truncate">
                        {node.relatieType}
                    </div>
                    <div className="text-xs font-bold text-slate-800 truncate">
                        {node.weergaveNaam}
                    </div>
                    <div className="text-[10px] text-slate-500 italic truncate">
                        {node.typeOmschrijving || node.type}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 1. Zoekbalk & Navigator-selectie */}
            <div className="relative max-w-md" ref={dropdownRef}>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kies start- of centraal object
                </label>
                <input
                    type="text"
                    value={zoekterm}
                    onChange={(e) => {
                        setZoekterm(e.target.value);
                        setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Typ om te zoeken..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10 shadow-sm"
                />

                {showDropdown && zoekResultaten.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {zoekResultaten.map((obj) => (
                            <button
                                key={obj.id}
                                type="button"
                                onClick={() => {
                                    setSelectedObjectId(obj.id);
                                    setZoekterm(obj.weergaveNaam);
                                    setShowDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm text-slate-800 transition"
                            >
                                <span className="font-semibold">{obj.weergaveNaam}</span>{" "}
                                <span className="text-xs text-slate-500 italic">({obj.type})</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Werkgebied (Grid met Boom links en Drawer rechts) */}
            <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
                {/* Boom-weergave */}
                <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 p-6 flex flex-col items-center justify-center relative overflow-x-auto">
                    {isPending && (
                        <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] flex items-center justify-center z-20">
                            <span className="text-sm font-semibold text-slate-600 animate-pulse">Data laden...</span>
                        </div>
                    )}

                    {!boomData ? (
                        <div className="text-center py-12 text-slate-400">
                            <p className="text-sm font-medium">Selecteer hierboven een object om de stamboom te openen.</p>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center space-y-8">

                            {/* OUDERS SECTIE */}
                            <div className="w-full flex justify-center gap-6 pb-4 border-b border-slate-200/60">
                                {boomData.oudersBoom && boomData.oudersBoom.length > 0 ? (
                                    boomData.oudersBoom.map((parent: any) => (
                                        <ParentBranch key={parent.id} node={parent} />
                                    ))
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Geen voorouders/bronnen bekend</span>
                                )}
                            </div>

                            {/* CENTRAAL OBJECT */}
                            <div className="w-full flex justify-center">
                                <div
                                    onClick={() => setDrawerObject(boomData.centraal)}
                                    onDoubleClick={() => setIsEditingCentral(true)}
                                    className="relative cursor-pointer p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-500 rounded-xl text-center shadow-md hover:shadow-lg hover:border-blue-600 transition select-none max-w-[240px] w-full"
                                    title="Klik voor historie | Dubbelklik om te bewerken"
                                >
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                                        Centraal Object
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-800 mb-1">
                                        {boomData.centraal.weergaveNaam}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium italic">
                                        {boomData.centraal.typeOmschrijving || boomData.centraal.type}
                                    </div>
                                    <div className="text-[9px] text-indigo-500 font-semibold mt-2">
                                        Dubbelklik om te bewerken
                                    </div>
                                </div>
                            </div>

                            {/* KINDEREN SECTIE */}
                            <div className="w-full pt-4 border-t border-slate-200/60 text-center">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                                    Eerste Generatie Kinderen (Directe afstammelingen)
                                </h4>
                                {boomData.kinderen && boomData.kinderen.length > 0 ? (
                                    <div className="flex flex-wrap gap-4 justify-center">
                                        {boomData.kinderen.map((child: any) => (
                                            <div
                                                key={child.id}
                                                onClick={() => setDrawerObject(child)}
                                                onDoubleClick={() => setSelectedObjectId(child.id)}
                                                className="cursor-pointer p-3 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-lg text-center shadow-sm transition select-none min-w-[130px] max-w-[170px] flex-1"
                                                title="Klik voor historie | Dubbelklik om centraal te maken"
                                            >
                                                <div className="text-[9px] text-indigo-500 font-bold mb-1 uppercase tracking-wider truncate">
                                                    {child.relatieType}
                                                </div>
                                                <div className="text-xs font-bold text-slate-800 truncate flex items-center justify-center gap-1">
                                                    {child.weergaveNaam}
                                                    {child.heeftKinderen && (
                                                        <span
                                                            className="inline-flex items-center justify-center bg-slate-100 text-slate-700 text-[9px] font-extrabold w-4 h-4 rounded-full"
                                                            title="Dit kind heeft zelf ook afstammelingen"
                                                        >
                                                            +
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 italic truncate">
                                                    {child.typeOmschrijving || child.type}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic block">Geen afstammelingen (eindstation)</span>
                                )}
                            </div>

                        </div>
                    )}
                </div>

                {/* Zijbalk (Drawer) met waarnemingen-historie */}
                {drawerObject && (
                    <div className="w-full lg:w-80 border border-slate-200 bg-slate-50/60 rounded-xl p-4 flex flex-col space-y-4">
                        <div className="flex justify-between items-start border-b pb-2">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">{drawerObject.weergaveNaam}</h3>
                                <p className="text-xs text-slate-500 italic">{drawerObject.typeOmschrijving || drawerObject.type}</p>
                            </div>
                            <button
                                onClick={() => setDrawerObject(null)}
                                className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded transition"
                            >
                                Sluiten
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Waarnemingen & Kenmerken
                            </h4>

                            {loadingDrawer ? (
                                <div className="space-y-2">
                                    <div className="h-12 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-12 bg-slate-200 rounded animate-pulse" />
                                </div>
                            ) : drawerHistorie.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Geen historische metingen of kenmerken bekend.</p>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                    {drawerHistorie.map((meting: any, i: number) => (
                                        <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-xs">
                                            <div className="flex justify-between text-slate-500 font-medium mb-1">
                                                <span>{meting.parameterNaam}</span>
                                                <span className="text-[9px]">
                                                    {new Date(meting.tijdstipUtc).toLocaleDateString("nl-NL")}
                                                </span>
                                            </div>
                                            <div className="text-slate-800 font-semibold text-sm">
                                                {meting.waarde}{" "}
                                                {meting.symbool && (
                                                    <span className="text-xs font-normal text-slate-500">{meting.symbool}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Edit Modal voor het Centrale Object */}
            {isEditingCentral && boomData?.centraal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-base font-bold text-slate-900">Centraal Object Bewerken</h3>
                            <button
                                onClick={() => {
                                    setIsEditingCentral(false);
                                    setEditFeedback(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Weergavenaam / Label
                                </label>
                                <input
                                    type="text"
                                    name="weergaveNaam"
                                    required
                                    defaultValue={boomData.centraal.weergaveNaam}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Objecttype
                                </label>
                                <select
                                    name="type"
                                    required
                                    defaultValue={boomData.centraal.type}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10"
                                >
                                    {objectTypen.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.omschrijving}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {editFeedback && (
                                <div
                                    className={`p-3 rounded-lg text-xs font-medium ${editFeedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                        }`}
                                >
                                    {editFeedback.message}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditingCentral(false);
                                        setEditFeedback(null);
                                    }}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                                >
                                    Annuleren
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-slate-400"
                                >
                                    {isPending ? "Opslaan..." : "Wijzigingen Opslaan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}