// app/objecten/ObjectenMainTabs.tsx
"use client";

import { useState } from "react";
import ObjectenLijstEnForm from "./ObjectenLijstEnForm";
import RelatieNetwerkForm from "./RelatieNetwerkForm";
// 🌳 Importeer de boom-navigator component
import ObjectenBoomNavigator from "./ObjectenBoomNavigator";

interface Props {
    objectTypen: any[];
    initialObjecten: any[];
    relatieTypen: any[];
}

export default function ObjectenMainTabs({ objectTypen, initialObjecten, relatieTypen }: Props) {
    // We kunnen de boom-navigator optioneel als standaard tab instellen
    const [activeTab, setActiveTab] = useState<"lijst" | "relaties" | "boom">("boom");

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab("lijst")}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === "lijst" 
                                ? "border-blue-500 text-blue-600" 
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                    >
                        Objecten & Aanmaken
                    </button>
                    <button
                        onClick={() => setActiveTab("relaties")}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === "relaties" 
                                ? "border-blue-500 text-blue-600" 
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                    >
                        Relatienetwerk (Edges)
                    </button>
                    <button
                        onClick={() => setActiveTab("boom")}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === "boom" 
                                ? "border-blue-500 text-blue-600" 
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                    >
                        🌳 Boom Navigator
                    </button>
                </nav>
            </div>

            {/* Tab Content Box */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200">
                {activeTab === "lijst" && (
                    <ObjectenLijstEnForm objectTypen={objectTypen} initialObjecten={initialObjecten} />
                )}
                {activeTab === "relaties" && (
                    <RelatieNetwerkForm
                        objecten={initialObjecten}
                        relatieTypen={relatieTypen}
                        objectTypen={objectTypen}
                    />
                )}
                {activeTab === "boom" && (
                    <ObjectenBoomNavigator 
                        objectTypen={objectTypen} 
                        relatieTypen={relatieTypen} 
                    />
                )}
            </div>
        </div>
    );
}