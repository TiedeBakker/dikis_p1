"use client";

import { useState } from "react";
import ParameterDefinitiesTab from "./ParameterDefinitiesTab";
import ParameterSetsTab from "./ParameterSetsTab";

interface Props {
  definities: any[];
  sets: any[];
  eenheden: any[];
}

export default function ParametersMainTabs({ definities, sets, eenheden }: Props) {
  const [activeTab, setActiveTab] = useState<"definities" | "sets">("definities");

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("definities")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "definities" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            1. Parameter Definities
          </button>
          <button
            onClick={() => setActiveTab("sets")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "sets" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            2. Parameter Sets & Structuur
          </button>
        </nav>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200">
        {activeTab === "definities" ? (
          <ParameterDefinitiesTab definities={definities} eenheden={eenheden} />
        ) : (
          <ParameterSetsTab sets={sets} definities={definities} />
        )}
      </div>
    </div>
  );
}