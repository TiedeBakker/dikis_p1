"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
    getObjecten,
    updateObjectAction,
    getBoomNavigatorData,
    createBulkChildrenAction,
    connectExistingChildAction
} from "@/app/actions/objecten";
import { getWaarnemingenHistorie } from "@/app/actions/waarnemingen";
import {
    getLaatsteMetingenVoorObject,
    getAlleParameterDefinities,
    getFormulierVeldenVoorSet,
    createWaarnemingenAction
} from "@/app/actions/waarnemingen";
import { getFormulierConfiguratieAction } from "@/app/actions/metadata";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
    ssr: false,
});

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

    // Opgelost: Één gecombineerde state met de juiste geldige TypeScript types!
    const [activeEditTab, setActiveEditTab] = useState<"basis" | "ouderrelaties" | "kindrelaties" | "kenmerken">("kenmerken");

    const [formConfig, setFormConfig] = useState<any[]>([]);
    const [huidigeMetingen, setHuidigeMetingen] = useState<Record<string, string>>({});
    const [mutatieMetingen, setMutatieMetingen] = useState<Record<string, string>>({});
    const [handmatigMetingTijdstip, setHandmatigMetingTijdstip] = useState<string>("");
    const [isSavingKenmerken, setIsSavingKenmerken] = useState(false);

    // Geladen relaties specifiek voor bewerken binnen de geopende modal
    const [modalOuderRelaties, setModalOuderRelaties] = useState<any[]>([]);
    const [modalKindRelaties, setModalKindRelaties] = useState<any[]>([]);

    // Inline zoekopdrachten voor het toevoegen van relaties binnen de tabs
    const [tabZoekterm, setTabZoekterm] = useState("");
    const [tabZoekResultaten, setTabZoekResultaten] = useState<any[]>([]);
    const [selectedTabObject, setSelectedTabObject] = useState<any | null>(null);
    const [showTabDropdown, setShowTabDropdown] = useState(false);

    // State voor bewerken van een specifiek kind-object
    const [editingChild, setEditingChild] = useState<any | null>(null);
    const [childEditFeedback, setChildEditFeedback] = useState<{ success: boolean; message: string } | null>(null);

    // Beheer & Toevoegen kinderen
    const [showAddChildren, setShowAddChildren] = useState(false);
    const [activeAddTab, setActiveAddTab] = useState<"generate" | "connect">("generate");

    // Formulier 1: Bulk aanmaken
    const [bulkType, setBulkType] = useState(objectTypen[0]?.id || "");
    const [bulkRelatie, setBulkRelatie] = useState(relatieTypen[0]?.id || "");
    const [bulkBasisNaam, setBulkBasisNaam] = useState("");
    const [bulkAantal, setBulkAantal] = useState(1);
    const [bulkStartNummer, setBulkStartNummer] = useState(1);
    const [bulkFeedback, setBulkFeedback] = useState<{ success: boolean; message: string } | null>(null);

    // Formulier 2: Bestaand koppelen
    const [connectRelatie, setConnectRelatie] = useState(relatieTypen[0]?.id || "");
    const [connectVolgorde, setConnectVolgorde] = useState(0);
    const [connectZoekterm, setConnectZoekterm] = useState("");
    const [connectZoekResultaten, setConnectZoekResultaten] = useState<any[]>([]);
    const [selectedConnectObject, setSelectedConnectObject] = useState<any | null>(null);
    const [showConnectDropdown, setShowConnectDropdown] = useState(false);
    const [connectFeedback, setConnectFeedback] = useState<{ success: boolean; message: string } | null>(null);
    const connectDropdownRef = useRef<HTMLDivElement>(null);

    const [beschikbareParameters, setBeschikbareParameters] = useState<any[]>([]);

    useEffect(() => {
        if (isEditingCentral && boomData?.centraal) {
            const targetObject = boomData.centraal;
            const nu = new Date();
            setHandmatigMetingTijdstip(new Date(nu.getTime() - nu.getTimezoneOffset() * 60000).toISOString().slice(0, 16));

            const objectTypeId = targetObject.type;
            console.log("Formulierconfiguratie ophalen voor object_type_id:", objectTypeId);

            getFormulierConfiguratieAction(objectTypeId).then((res) => {
                if (res && res.success && Array.isArray(res.data)) {
                    setFormConfig(res.data);
                } else {
                    getFormulierVeldenVoorSet(objectTypeId).then((fallbackVelden) => {
                        if (fallbackVelden) setFormConfig(fallbackVelden);
                    });
                }
            });

            getLaatsteMetingenVoorObject(targetObject.id).then((metingenLijst) => {
                const waardenMap: Record<string, string> = {};
                if (metingenLijst) {
                    metingenLijst.forEach((m) => {
                        waardenMap[m.parameterId] = m.waarde;
                    });
                }
                setHuidigeMetingen(waardenMap);
                setMutatieMetingen(waardenMap);
            });

            getAlleParameterDefinities().then((definities) => {
                if (definities) {
                    setBeschikbareParameters(definities);
                }
            });

            import("@/app/actions/objecten").then((actions) => {
                actions.getObjectRelatiesVoorMutatie(targetObject.id).then((res) => {
                    setModalOuderRelaties(res.ouders);
                    setModalKindRelaties(res.kinderen);
                });
            });

        } else {
            setFormConfig([]);
            setHuidigeMetingen({});
            setMutatieMetingen({});
            setBeschikbareParameters([]);
        }
    }, [isEditingCentral, boomData?.centraal]);

    useEffect(() => {
        if (!tabZoekterm) {
            setTabZoekResultaten([]);
            return;
        }
        const delay = setTimeout(async () => {
            const res = await getObjecten({ zoekterm: tabZoekterm });
            setTabZoekResultaten(res.filter(o => o.id !== boomData?.centraal?.id));
        }, 200);
        return () => clearTimeout(delay);
    }, [tabZoekterm, boomData?.centraal?.id]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
            if (connectDropdownRef.current && !connectDropdownRef.current.contains(event.target as Node)) {
                setShowConnectDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

    useEffect(() => {
        if (!connectZoekterm) {
            setConnectZoekResultaten([]);
            return;
        }
        const delayDebounce = setTimeout(async () => {
            const resulten = await getObjecten({ zoekterm: connectZoekterm });
            const gefilterd = resulten.filter(obj => obj.id !== selectedObjectId);
            setConnectZoekResultaten(gefilterd);
        }, 200);

        return () => clearTimeout(delayDebounce);
    }, [connectZoekterm, selectedObjectId]);

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

    const reloadBoomData = () => {
        if (selectedObjectId) {
            startTransition(async () => {
                const data = await getBoomNavigatorData(selectedObjectId);
                setBoomData(data);
            });
        }
    };

    const handleQuickAddChildren = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedObjectId) return;

        setBulkFeedback(null);
        const formData = new FormData();
        formData.append("vanObjectId", selectedObjectId);
        formData.append("kindObjectType", bulkType);
        formData.append("relatieTypeId", bulkRelatie);
        formData.append("basisNaam", bulkBasisNaam);
        formData.append("aantal", bulkAantal.toString());
        formData.append("startVolgorde", bulkStartNummer.toString());

        startTransition(async () => {
            const result = await createBulkChildrenAction(formData);
            if (result.success) {
                setBulkFeedback({ success: true, message: result.message });
                setBulkBasisNaam("");
                reloadBoomData();
                setTimeout(() => {
                    setShowAddChildren(false);
                    setBulkFeedback(null);
                }, 1500);
            } else {
                setBulkFeedback({ success: false, message: result.message });
            }
        });
    };

    const handleConnectExistingChild = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedObjectId || !selectedConnectObject) return;

        setConnectFeedback(null);
        const formData = new FormData();
        formData.append("vanObjectId", selectedObjectId);
        formData.append("naarObjectId", selectedConnectObject.id);
        formData.append("relatieTypeId", connectRelatie);
        formData.append("volgorde", connectVolgorde.toString());

        startTransition(async () => {
            const result = await connectExistingChildAction(formData);
            if (result.success) {
                setConnectFeedback({ success: true, message: result.message });
                setSelectedConnectObject(null);
                setConnectZoekterm("");
                reloadBoomData();
                setTimeout(() => {
                    setShowAddChildren(false);
                    setConnectFeedback(null);
                }, 1500);
            } else {
                setConnectFeedback({ success: false, message: result.message });
            }
        });
    };

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
                reloadBoomData();
            }
        });
    };

    const handleSaveKenmerken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!boomData?.centraal) return;

        setIsSavingKenmerken(true);
        const fieldsData = Object.entries(mutatieMetingen).map(([parameterId, waarde]) => ({
            parameterId,
            waarde
        }));

        const optioneelTijdstip = handmatigMetingTijdstip
            ? new Date(handmatigMetingTijdstip).toISOString()
            : undefined;

        const res = await createWaarnemingenAction(
            boomData.centraal.id,
            fieldsData,
            optioneelTijdstip
        );

        setIsSavingKenmerken(false);

        if (res.success) {
            toast.success(res.message || "Kenmerken succesvol bijgewerkt!");
            setIsEditingCentral(false);
            reloadBoomData();
        } else {
            toast.error(res.message || "Fout bij het opslaan van kenmerken.");
        }
    };

    const handleSaveChildEdit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingChild) return;

        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await updateObjectAction(editingChild.id, formData);
            setChildEditFeedback(res);
            if (res.success) {
                setEditingChild(null);
                setChildEditFeedback(null);
                reloadBoomData();
            }
        });
    };

    function ParentBranch({ node }: { node: any }) {
        return (
            <div className="flex flex-col items-center flex-1 min-w-32.5">
                {node.ouders && node.ouders.length > 0 && (
                    <div className="flex gap-4 justify-center w-full mb-3 pb-2 border-b border-dashed border-slate-200">
                        {node.ouders.map((p: any) => (
                            <ParentBranch key={p.id} node={p} />
                        ))}
                    </div>
                )}

                <div
                    onClick={() => setDrawerObject(node)}
                    onDoubleClick={() => setSelectedObjectId(node.id)}
                    className="cursor-pointer p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-slate-50 rounded-lg text-center shadow-sm transition select-none max-w-40 w-full"
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

    const formatToDatetimeLocal = (isoString?: string) => {
        if (!isoString) return "";
        return new Date(isoString).toISOString().slice(0, 16);
    };

    const handleUpdateRelatieCore = async (relatieId: string, fields: any, isOuder: boolean) => {
        const { updateRelatieCoreAction } = await import("@/app/actions/objecten");
        const res = await updateRelatieCoreAction(relatieId, fields);
        if (res.success) {
            toast.success(res.message);
            const updater = (prev: any[]) => prev.map(r => r.relatieId === relatieId ? { ...r, ...fields } : r);
            if (isOuder) setModalOuderRelaties(updater); else setModalKindRelaties(updater);
            reloadBoomData();
        } else {
            toast.error(res.message);
        }
    };

    const handleTerminateRelatie = async (relatieId: string, isOuder: boolean) => {
        if (!confirm("Weet u zeker dat u deze relatie wilt ontkoppelen?")) return;
        const { terminateRelatieAction } = await import("@/app/actions/objecten");
        const res = await terminateRelatieAction(relatieId);
        if (res.success) {
            toast.success("Relatie ontkoppeld");
            if (isOuder) {
                setModalOuderRelaties(prev => prev.filter(r => r.relatieId !== relatieId));
            } else {
                setModalKindRelaties(prev => prev.filter(r => r.relatieId !== relatieId));
            }
            reloadBoomData();
        }
    };

    const handleAddRelatieInTab = async (e: React.FormEvent, type: "ouder" | "kind") => {
        e.preventDefault();
        if (!boomData?.centraal || !selectedTabObject) return;

        const targetForm = e.currentTarget as HTMLFormElement;
        const formData = new FormData(targetForm);

        const vanId = type === "ouder" ? selectedTabObject.id : boomData.centraal.id;
        const naarId = type === "ouder" ? boomData.centraal.id : selectedTabObject.id;

        const actionFormData = new FormData();
        actionFormData.append("vanObjectId", vanId);
        actionFormData.append("naarObjectId", naarId);
        actionFormData.append("relatieTypeId", formData.get("relatieTypeId") as string);
        actionFormData.append("volgorde", formData.get("volgorde") as string);

        const res = await connectExistingChildAction(actionFormData);
        if (res.success) {
            toast.success(res.message);
            setSelectedTabObject(null);
            setTabZoekterm("");
            const actions = await import("@/app/actions/objecten");
            const refreshed = await actions.getObjectRelatiesVoorMutatie(boomData.centraal.id);
            setModalOuderRelaties(refreshed.ouders);
            setModalKindRelaties(refreshed.kinderen);
            reloadBoomData();
        } else {
            toast.error(res.message);
        }
    };

    return (
        <div className="space-y-6">
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

            <div className="flex flex-col lg:flex-row gap-6 min-h-125">
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
                            <div className="w-full flex justify-center gap-6 pb-4 border-b border-slate-200/60">
                                {boomData.oudersBoom && boomData.oudersBoom.length > 0 ? (
                                    boomData.oudersBoom.map((parent: any) => (
                                        <ParentBranch key={parent.id} node={parent} />
                                    ))
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Geen voorouders/bronnen bekend</span>
                                )}
                            </div>

                            <div className="w-full flex justify-center">
                                <div
                                    onClick={() => setDrawerObject(boomData.centraal)}
                                    onDoubleClick={() => setIsEditingCentral(true)}
                                    className="relative cursor-pointer p-5 bg-linear-to-br from-blue-50 to-indigo-50 border-2 border-blue-500 rounded-xl text-center shadow-md hover:shadow-lg hover:border-blue-600 transition select-none max-w-60
                                     w-full"
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

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 w-full">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Afstammelingen (1e Generatie) ({boomData.kinderen.length})
                                    </h3>
                                    <button
                                        onClick={() => setShowAddChildren(!showAddChildren)}
                                        className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-semibold transition"
                                    >
                                        {showAddChildren ? "✕ Sluiten" : "➕ Kind Toevoegen / Koppelen"}
                                    </button>
                                </div>

                                {showAddChildren && (
                                    <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200 space-y-4 shadow-sm">
                                        <div className="flex border-b border-slate-200 pb-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setActiveAddTab("generate")}
                                                className={`text-xs font-bold pb-1 transition-all ${activeAddTab === "generate" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                                            >
                                                ✨ Snel Genereren
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveAddTab("connect")}
                                                className={`text-xs font-bold pb-1 transition-all ${activeAddTab === "connect" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                                            >
                                                🔗 Bestaand Koppelen
                                            </button>
                                        </div>

                                        {activeAddTab === "generate" && (
                                            <form onSubmit={handleQuickAddChildren} className="space-y-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Type kind</label>
                                                        <select
                                                            value={bulkType}
                                                            onChange={(e) => setBulkType(e.target.value)}
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white focus:outline-none"
                                                        >
                                                            {objectTypen.map(t => (
                                                                <option key={t.id} value={t.id}>{t.omschrijving}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Relatietype</label>
                                                        <select
                                                            value={bulkRelatie}
                                                            onChange={(e) => setBulkRelatie(e.target.value)}
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white focus:outline-none"
                                                        >
                                                            {relatieTypen.map(r => (
                                                                <option key={r.id} value={r.id}>{r.omschrijving}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Basisnaam (bijv. 'Plank')</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={bulkBasisNaam}
                                                            onChange={(e) => setBulkBasisNaam(e.target.value)}
                                                            placeholder="Plank, Doos, Vak"
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Aantal (1-50)</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="50"
                                                            value={bulkAantal}
                                                            onChange={(e) => setBulkAantal(parseInt(e.target.value) || 1)}
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Start volgnummer</label>
                                                        <input
                                                            type="number"
                                                            value={bulkStartNummer}
                                                            onChange={(e) => setBulkStartNummer(parseInt(e.target.value) || 1)}
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                {bulkFeedback && (
                                                    <div className={`text-xs p-2 rounded ${bulkFeedback.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                                        {bulkFeedback.message}
                                                    </div>
                                                )}

                                                <div className="flex justify-end gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAddChildren(false)}
                                                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1"
                                                    >
                                                        Annuleren
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isPending || !bulkBasisNaam}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded transition disabled:bg-slate-400"
                                                    >
                                                        {isPending ? "Genereren..." : "🚀 Genereren & Koppelen"}
                                                    </button>
                                                </div>
                                            </form>
                                        )}

                                        {activeAddTab === "connect" && (
                                            <form onSubmit={handleConnectExistingChild} className="space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div className="relative md:col-span-1" ref={connectDropdownRef}>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                                            Zoek bestaand object
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={selectedConnectObject ? selectedConnectObject.weergaveNaam : connectZoekterm}
                                                            onChange={(e) => {
                                                                setConnectZoekterm(e.target.value);
                                                                setSelectedConnectObject(null);
                                                                setShowConnectDropdown(true);
                                                            }}
                                                            onFocus={() => setShowConnectDropdown(true)}
                                                            placeholder="Typ naam..."
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white focus:outline-none"
                                                        />

                                                        {selectedConnectObject && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedConnectObject(null);
                                                                    setConnectZoekterm("");
                                                                }}
                                                                className="absolute right-2 top-6 text-[10px] text-red-500 hover:underline"
                                                            >
                                                                Wis
                                                            </button>
                                                        )}

                                                        {showConnectDropdown && connectZoekResultaten.length > 0 && (
                                                            <div className="absolute z-40 w-full mt-1 bg-white border border-slate-200 rounded shadow-md max-h-40 overflow-y-auto">
                                                                {connectZoekResultaten.map((obj) => (
                                                                    <button
                                                                        key={obj.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedConnectObject(obj);
                                                                            setShowConnectDropdown(false);
                                                                        }}
                                                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 text-[11px] text-slate-800 transition"
                                                                    >
                                                                        <span className="font-semibold">{obj.weergaveNaam}</span>{" "}
                                                                        <span className="text-[10px] text-slate-500 italic">({obj.type})</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Relatietype</label>
                                                        <select
                                                            value={connectRelatie}
                                                            onChange={(e) => setConnectRelatie(e.target.value)}
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white focus:outline-none"
                                                        >
                                                            {relatieTypen.map(r => (
                                                                <option key={r.id} value={r.id}>{r.omschrijving}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Volgorde</label>
                                                        <input
                                                            type="number"
                                                            value={connectVolgorde}
                                                            onChange={(e) => setConnectVolgorde(parseInt(e.target.value) || 0)}
                                                            className="w-full text-xs rounded border border-slate-300 p-1.5 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                {connectFeedback && (
                                                    <div className={`text-xs p-2 rounded ${connectFeedback.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                                        {connectFeedback.message}
                                                    </div>
                                                )}

                                                <div className="flex justify-end gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAddChildren(false)}
                                                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1"
                                                    >
                                                        Annuleren
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isPending || !selectedConnectObject}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded transition disabled:bg-slate-400"
                                                    >
                                                        {isPending ? "Koppelen..." : "🔗 Bestaand Koppelen"}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {boomData.kinderen.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic bg-white p-3 rounded-lg border border-dashed text-center">
                                        Geen afstammelingen gekoppeld. Gebruik de knop hierboven om er direct aan te maken of te koppelen!
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {boomData.kinderen.map((kind: any) => (
                                            <div
                                                key={kind.id}
                                                onDoubleClick={() => setSelectedObjectId(kind.id)}
                                                onClick={() => setDrawerObject(kind)}
                                                className="p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer relative group"
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingChild(kind);
                                                    }}
                                                    className="absolute top-2 right-2 p-1 text-[11px] bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Bewerk dit object"
                                                >
                                                    ✏️
                                                </button>

                                                <div className="flex items-start justify-between pr-5">
                                                    <div>
                                                        <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mb-1">
                                                            {kind.typeOmschrijving || kind.type}
                                                        </span>
                                                        <h4 className="text-xs font-bold text-slate-800 truncate">
                                                            {kind.weergaveNaam}
                                                        </h4>
                                                        {kind.nederlandseNaam && (
                                                            <p className="text-[10px] text-slate-500 italic">
                                                                {kind.nederlandseNaam}
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-slate-400 mt-1">
                                                            Relatie: <span className="font-semibold">{kind.relatieType}</span>
                                                            {kind.volgorde !== 0 && ` (volgorde: ${kind.volgorde})`}
                                                        </p>
                                                    </div>
                                                    {kind.heeftKinderen && (
                                                        <span
                                                            title="Heeft verdere afstammelingen"
                                                            className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold"
                                                        >
                                                            ↳
                                                        </span>
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
                                <div className="space-y-2 max-h-100 overflow-y-auto pr-1">
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

            {/* Edit Modal voor het Centrale Object */}
            {isEditingCentral && boomData?.centraal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full border border-slate-200 p-6 flex flex-col max-h-[99vh]">

                        <div className="flex justify-between items-center border-b pb-3 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Centraal Object Beheren 123</h3>
                                <p className="text-xs text-slate-500">ID: {boomData.centraal.id}</p>
                            </div>
                            <button
                                onClick={() => setIsEditingCentral(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form id="objectBasisForm" onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4 border-b border-slate-100 shrink-0 bg-slate-50/50 p-3 rounded-lg mb-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Weergavenaam / Label
                                </label>
                                <input
                                    type="text"
                                    name="weergaveNaam"
                                    required
                                    defaultValue={boomData.centraal.weergaveNaam}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none h-9 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Objecttype
                                </label>
                                <select
                                    name="type"
                                    required
                                    defaultValue={boomData.centraal.type}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none h-9 shadow-sm"
                                >
                                    {objectTypen.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.omschrijving}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Aanmaakdatum
                                </label>
                                <input
                                    type="datetime-local"
                                    name="createdAt"
                                    defaultValue={formatToDatetimeLocal(boomData.centraal.createdAt)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none h-9 shadow-sm"
                                />
                            </div>
                        </form>

                        <div className="flex border-b border-slate-200 gap-4 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveEditTab("ouderrelaties")}
                                className={`text-xs font-bold pb-2 transition-all ${activeEditTab === "ouderrelaties" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                🔗 Mutatie ouderrelaties (Omhangen)
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveEditTab("kindrelaties")}
                                className={`text-xs font-bold pb-2 transition-all ${activeEditTab === "kindrelaties" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                🌿 Mutatie kindrelaties
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveEditTab("kenmerken")}
                                className={`text-xs font-bold pb-2 transition-all ${activeEditTab === "kenmerken" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                ⚙️ Mutatie kenmerken
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
                            {activeEditTab === "ouderrelaties" && (
                                <div className="space-y-4">
                                    <div className="bg-slate-50 border p-3 rounded-lg">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase mb-2">➕ Nieuwe Ouder Relatie Leggen (Omhangen in boom)</h4>
                                        <form onSubmit={(e) => handleAddRelatieInTab(e, "ouder")} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                                            <div className="relative">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Zoek Bovenliggend Object</label>
                                                <input
                                                    type="text"
                                                    value={selectedTabObject ? selectedTabObject.weergaveNaam : tabZoekterm}
                                                    onChange={(e) => { setTabZoekterm(e.target.value); setSelectedTabObject(null); setShowTabDropdown(true); }}
                                                    placeholder="Typ naam..."
                                                    className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                                                />
                                                {showTabDropdown && tabZoekResultaten.length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-md max-h-40 overflow-y-auto text-xs">
                                                        {tabZoekResultaten.map(o => (
                                                            <button key={o.id} type="button" onClick={() => { setSelectedTabObject(o); setShowTabDropdown(false); }} className="w-full text-left p-1.5 hover:bg-slate-100 block">
                                                                {o.weergaveNaam} ({o.type})
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Relatietype</label>
                                                <select name="relatieTypeId" required className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white">
                                                    {relatieTypen.map(r => <option key={r.id} value={r.id}>{r.omschrijving}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Volgorde</label>
                                                <input type="number" name="volgorde" defaultValue="0" className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white" />
                                            </div>
                                            <button type="submit" disabled={!selectedTabObject} className="bg-blue-600 text-white text-xs font-semibold p-1.5 rounded h-8 disabled:bg-slate-300">
                                                Linken als Ouder
                                            </button>
                                        </form>
                                    </div>

                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200">
                                                <th className="p-2">Bovenliggend Object (Ouder)</th>
                                                <th className="p-2">Relatietype</th>
                                                <th className="p-2">Volgorde</th>
                                                <th className="p-2">Gekoppeld op</th>
                                                <th className="p-2 text-right">Actie</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modalOuderRelaties.map((rel) => (
                                                <tr key={rel.relatieId} className="border-b hover:bg-slate-50/50">
                                                    <td className="p-2 font-medium">{rel.weergaveNaam} <span className="text-[10px] text-slate-400">({rel.typeOmschrijving})</span></td>
                                                    <td className="p-2">
                                                        <select value={rel.relatieTypeId} onChange={(e) => handleUpdateRelatieCore(rel.relatieId, { relatieTypeId: e.target.value }, true)} className="border rounded p-0.5 bg-white">
                                                            {relatieTypen.map(r => <option key={r.id} value={r.id}>{r.omschrijving}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2">
                                                        <input type="number" value={rel.volgorde} onChange={(e) => handleUpdateRelatieCore(rel.relatieId, { volgorde: parseInt(e.target.value) || 0 }, true)} className="border rounded w-14 p-0.5 text-center" />
                                                    </td>
                                                    <td className="p-2">
                                                        <input type="datetime-local" value={formatToDatetimeLocal(rel.createdAt)} onChange={(e) => handleUpdateRelatieCore(rel.relatieId, { createdAt: e.target.value }, true)} className="border rounded text-[11px] p-0.5" />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        <button type="button" onClick={() => handleTerminateRelatie(rel.relatieId, true)} className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded font-bold">✕ Ontkoppelen</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeEditTab === "kindrelaties" && (
                                <div className="space-y-4">
                                    <div className="bg-slate-50 border p-3 rounded-lg">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase mb-2">➕ Bestaand Kind-object Koppelen</h4>
                                        <form onSubmit={(e) => handleAddRelatieInTab(e, "kind")} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                                            <div className="relative">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Zoek Bestaand Object</label>
                                                <input
                                                    type="text"
                                                    value={selectedTabObject ? selectedTabObject.weergaveNaam : tabZoekterm}
                                                    onChange={(e) => { setTabZoekterm(e.target.value); setSelectedTabObject(null); setShowTabDropdown(true); }}
                                                    placeholder="Typ naam..."
                                                    className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                                                />
                                                {showTabDropdown && tabZoekResultaten.length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-md max-h-40 overflow-y-auto text-xs">
                                                        {tabZoekResultaten.map(o => (
                                                            <button key={o.id} type="button" onClick={() => { setSelectedTabObject(o); setShowTabDropdown(false); }} className="w-full text-left p-1.5 hover:bg-slate-100 block">
                                                                {o.weergaveNaam} ({o.type})
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Relatietype</label>
                                                <select name="relatieTypeId" required className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white">
                                                    {relatieTypen.map(r => <option key={r.id} value={r.id}>{r.omschrijving}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Volgorde-index</label>
                                                <input type="number" name="volgorde" defaultValue="0" className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white" />
                                            </div>
                                            <button type="submit" disabled={!selectedTabObject} className="bg-blue-600 text-white text-xs font-semibold p-1.5 rounded h-8 disabled:bg-slate-300">
                                                Koppelen als Kind
                                            </button>
                                        </form>
                                    </div>

                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200">
                                                <th className="p-2">Onderliggend Object (Kind)</th>
                                                <th className="p-2">Relatietype</th>
                                                <th className="p-2">Volgorde (Slepen/Positie)</th>
                                                <th className="p-2">Gekoppeld op</th>
                                                <th className="p-2 text-right">Actie</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modalKindRelaties.map((rel, index) => (
                                                <tr key={rel.relatieId} className="border-b hover:bg-slate-50/50">
                                                    <td className="p-2 font-medium">{rel.weergaveNaam} <span className="text-[10px] text-slate-400">({rel.typeOmschrijving})</span></td>
                                                    <td className="p-2">
                                                        <select value={rel.relatieTypeId} onChange={(e) => handleUpdateRelatieCore(rel.relatieId, { relatieTypeId: e.target.value }, false)} className="border rounded p-0.5 bg-white">
                                                            {relatieTypen.map(r => <option key={r.id} value={r.id}>{r.omschrijving}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 flex items-center gap-2">
                                                        <input type="number" value={rel.volgorde} onChange={(e) => handleUpdateRelatieCore(rel.relatieId, { volgorde: parseInt(e.target.value) || 0 }, false)} className="border rounded w-14 p-0.5 text-center" />
                                                        <div className="flex flex-col text-[9px] text-slate-400">
                                                            <button type="button" disabled={index === 0} onClick={() => handleUpdateRelatieCore(rel.relatieId, { volgorde: rel.volgorde - 1 }, false)} className="hover:text-slate-900 disabled:opacity-30">▲ Omhoog</button>
                                                            <button type="button" disabled={index === modalKindRelaties.length - 1} onClick={() => handleUpdateRelatieCore(rel.relatieId, { volgorde: rel.volgorde + 1 }, false)} className="hover:text-slate-900 disabled:opacity-30">▼ Omlaag</button>
                                                        </div>
                                                    </td>
                                                    <td className="p-2">
                                                        <input type="datetime-local" value={formatToDatetimeLocal(rel.createdAt)} onChange={(e) => handleUpdateRelatieCore(rel.relatieId, { createdAt: e.target.value }, false)} className="border rounded text-[11px] p-0.5" />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        <button type="button" onClick={() => handleTerminateRelatie(rel.relatieId, false)} className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded font-bold">✕ Verwijderen</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeEditTab === "kenmerken" && (
                                <form id="kenmerkenForm" onSubmit={handleSaveKenmerken} className="space-y-6">
                                    {/* DEEL A & B: Bestaande & Vaste Parameters */}
                                    <div className="bg-slate-50 border p-4 rounded-lg space-y-4">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b">
                                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                ⚙️ Kenmerken & Waarnemingen (Vast & Extra)
                                            </h4>
                                            <div className="w-full sm:w-auto">
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                                    Afwijkend Meting Tijdstip (Optioneel)
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={handmatigMetingTijdstip}
                                                    onChange={(e) => setHandmatigMetingTijdstip(e.target.value)}
                                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] focus:outline-none shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* We bouwen een gecombineerde lijst op van Deel A (formConfig) en Deel B (historisch gemeten extra parameters) */}
                                        {(() => {
                                            // Maak een set van alle parameter ID's die al in Deel A (formConfig) zitten
                                            const bestaandeParamIds = new Set(formConfig.map(v => v.parameterId || v.parameter_id || v.id));

                                            // Kopieer de vaste velden
                                            const gecombineerdeVelden = [...formConfig];

                                            // Voeg parameters uit huidigeMetingen toe die nog NIET in de vaste configuratie zaten (Deel B)
                                            Object.keys(huidigeMetingen).forEach((huidigId) => {
                                                if (!bestaandeParamIds.has(huidigId)) {
                                                    // Zoek de definitie op in de beschikbare parameters voor de juiste naam/eenheid
                                                    const info = beschikbareParameters.find(p => p.id === huidigId);
                                                    gecombineerdeVelden.push({
                                                        parameterId: huidigId,
                                                        parameterNaam: info?.omschrijving || info?.naam || `Extra Parameter (${huidigId})`,
                                                        eenheidSymbool: info?.symbool || info?.eenheidSymbool,
                                                        veldType: info?.veldType || "text",
                                                        isExtra: true // Vlag om aan te geven dat dit een extra parameter is
                                                    });
                                                }
                                            });

                                            if (gecombineerdeVelden.length === 0) {
                                                return (
                                                    <p className="text-xs text-slate-400 italic py-4 text-center">
                                                        Geen actieve of historische kenmerken aanwezig. Gebruik de knop hieronder om er een toe te voegen.
                                                    </p>
                                                );
                                            }

                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {gecombineerdeVelden.map((veld: any) => {
                                                        const paramId = veld.parameterId || veld.parameter_id || veld.id;
                                                        const parameterNaam = veld.parameterNaam || veld.label || veld.omschrijving || veld.naam || "Onbekende parameter";

                                                        const isRichText = veld.veldType === "richtext" || veld.type === "richtext";
                                                        const isTextArea = veld.veldType === "textarea" || veld.type === "textarea";
                                                        const isSelect = veld.veldType === "select" || veld.type === "select";

                                                        return (
                                                            <div key={paramId} className={`space-y-1 relative group p-2 rounded-lg transition-colors ${veld.isExtra ? "bg-amber-50/50 border border-dashed border-amber-200" : ""} ${isRichText || isTextArea ? "md:col-span-2" : ""}`}>
                                                                <label className=" text-xs font-bold text-slate-700 flex items-center justify-between">
                                                                    <span>
                                                                        {parameterNaam}
                                                                        {veld.verplicht && <span className="text-red-500 ml-0.5">*</span>}
                                                                    </span>
                                                                    {veld.isExtra && (
                                                                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium uppercase tracking-tight">
                                                                            Extra toegevoegd
                                                                        </span>
                                                                    )}
                                                                </label>

                                                                {isRichText ? (
                                                                    <div className="bg-white border rounded-lg overflow-hidden">
                                                                        <RichTextEditor
                                                                            value={mutatieMetingen[paramId] || ""}
                                                                            onChange={(html) => setMutatieMetingen(prev => ({ ...prev, [paramId]: html }))}
                                                                        />
                                                                    </div>
                                                                ) : isTextArea ? (
                                                                    <textarea
                                                                        value={mutatieMetingen[paramId] || ""}
                                                                        onChange={(e) => setMutatieMetingen(prev => ({ ...prev, [paramId]: e.target.value }))}
                                                                        rows={3}
                                                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none shadow-sm"
                                                                    />
                                                                ) : isSelect ? (
                                                                    <select
                                                                        value={mutatieMetingen[paramId] || ""}
                                                                        onChange={(e) => setMutatieMetingen(prev => ({ ...prev, [paramId]: e.target.value }))}
                                                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none h-9 shadow-sm"
                                                                    >
                                                                        <option value="">-- Maak een keuze --</option>
                                                                        {veld.opties?.map((o: any) => (
                                                                            <option key={o.waarde || o} value={o.waarde || o}>
                                                                                {o.label || o}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <div className="relative flex items-center">
                                                                        <input
                                                                            type={veld.veldType === "number" || veld.type === "number" ? "number" : "text"}
                                                                            value={mutatieMetingen[paramId] || ""}
                                                                            onChange={(e) => setMutatieMetingen(prev => ({ ...prev, [paramId]: e.target.value }))}
                                                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none h-9 shadow-sm pr-12"
                                                                        />
                                                                        {(veld.eenheidSymbool || veld.symbool) && (
                                                                            <span className="absolute right-3 text-xs text-slate-400 font-medium pointer-events-none">
                                                                                {veld.eenheidSymbool || veld.symbool}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {huidigeMetingen[paramId] !== undefined && (
                                                                    <p className="text-[10px] text-slate-400 italic pl-1">
                                                                        Huidige waarde: <span className="font-semibold text-slate-600">{huidigeMetingen[paramId]}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* DEEL B: Handmatig een NIEUWE extra parameter selecteren en toevoegen aan de actieve sessie */}
                                    <div className="bg-slate-100 border border-slate-200 p-3 rounded-lg">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase mb-2">
                                            ➕ Extra parameter handmatig toevoegen aan dit object
                                        </h4>
                                        <div className="flex flex-col sm:flex-row gap-2 items-end">
                                            <div className="flex-1 w-full">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Kies parameter uit de hoofdlijst</label>
                                                <select
                                                    id="extraParameterSelector"
                                                    className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white focus:outline-none h-9"
                                                    defaultValue=""
                                                    onChange={(e) => {
                                                        const gekozenId = e.target.value;
                                                        if (!gekozenId) return;

                                                        // Voeg de gekozen parameter direct toe aan de mutatie-state (met een lege string als startwaarde)
                                                        setMutatieMetingen(prev => {
                                                            if (prev[gekozenId] !== undefined) return prev; // Bestaat al
                                                            return { ...prev, [gekozenId]: "" };
                                                        });

                                                        // Reset de dropdown naar de placeholder
                                                        e.target.value = "";
                                                    }}
                                                >
                                                    <option value="" disabled>-- Selecteer een parameter om direct toe te voegen --</option>
                                                    {(() => {
                                                        // Filter parameters die al getoond worden uit in de selectbox
                                                        const actieveIds = new Set([
                                                            ...formConfig.map(v => v.parameterId || v.parameter_id || v.id),
                                                            ...Object.keys(mutatieMetingen)
                                                        ]);

                                                        return beschikbareParameters
                                                            .filter(p => !actieveIds.has(p.id))
                                                            .map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.omschrijving || p.naam} {p.symbool ? `(${p.symbool})` : ""}
                                                                </option>
                                                            ));
                                                    })()}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t shrink-0">
                            <div className="text-[10px] text-slate-400">
                                * Klik op opslaan om zowel de basisgegevens als de kenmerken te bewaren.
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingCentral(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                                >
                                    Annuleren
                                </button>
                                <button
                                    type="submit"
                                    form="objectBasisForm"
                                    disabled={isPending}
                                    className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition disabled:bg-slate-400"
                                >
                                    {isPending ? "Basis opslaan..." : "Basis opslaan"}
                                </button>
                                <button
                                    type="submit"
                                    form="kenmerkenForm"
                                    disabled={isSavingKenmerken}
                                    className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-slate-400"
                                >
                                    {isSavingKenmerken ? "Kenmerken opslaan..." : "Kenmerken opslaan"}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Edit Modal voor een Kind-object */}
            {editingChild && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-base font-bold text-slate-900">Kind-object Bewerken</h3>
                            <button
                                onClick={() => {
                                    setEditingChild(null);
                                    setChildEditFeedback(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveChildEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Weergavenaam / Label
                                </label>
                                <input
                                    type="text"
                                    name="weergaveNaam"
                                    required
                                    defaultValue={editingChild.weergaveNaam}
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
                                    defaultValue={editingChild.type}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10"
                                >
                                    {objectTypen.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.omschrijving}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Aanmaakdatum (createdAt)
                                </label>
                                <input
                                    type="datetime-local"
                                    name="createdAt"
                                    defaultValue={formatToDatetimeLocal(editingChild.createdAt)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none h-10"
                                />
                            </div>

                            {childEditFeedback && (
                                <div className={`p-3 rounded-lg text-xs font-medium ${childEditFeedback.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                    {childEditFeedback.message}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingChild(null);
                                        setChildEditFeedback(null);
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