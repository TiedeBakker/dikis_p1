// components/NetworkHoverCard.tsx
"use client";

import { useState, useEffect } from "react";
import { getLaatsteMetingenVoorObject } from "@/app/actions/waarnemingen";

interface HoverCardProps {
  objectId: string;
  objectNaam: string;
  objectType: string;
  children: React.ReactNode; // Het graaf-element (bijv. de node of tekst) waar je over hovert
}

export default function NetworkHoverCard({ objectId, objectNaam, objectType, children }: HoverCardProps) {
  const [hovered, setHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metingen, setMetingen] = useState<any[]>([]);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // 1. Reset de metingen zodra het object ID verandert
  useEffect(() => {
    setMetingen([]);
  }, [objectId]);

  // 2. Haal data op als er gehoverd wordt en er nog geen metingen geladen zijn
  useEffect(() => {
    if (hovered && metingen.length === 0) {
      setLoading(true);
      getLaatsteMetingenVoorObject(objectId).then((data) => {
        setMetingen(data || []);
        setLoading(false);
      });
    }
  }, [hovered, objectId, metingen.length]);

  // 3. OPTIONEEL/AANBEVOLEN: Schoon de data op als de muis het object verlaat
  // Dit voorkomt dat je bij een snelle re-hover oude data flitst.
  const handleMouseLeave = () => {
    setHovered(false);
    setMetingen([]); // Direct leegmaken bij verlaten
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    // Positioneer de pop-up 15 pixels rechtsonder de muiscursor
    setCoords({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      className="inline-block relative cursor-pointer"
    >
      {/* Het originele netwerkelement (node / bolletje / tekst) */}
      {children}

      {/* De Pop-up Card (Portal-vrij, fixed gepositioneerd ten opzichte van de viewport) */}
      {hovered && (
        <div
          style={{
            position: "fixed",
            left: `${coords.x}px`,
            top: `${coords.y}px`,
          }}
          className="z-50 w-64 bg-slate-900/95 text-slate-100 rounded-xl p-3 border border-slate-800 shadow-2xl backdrop-blur-md pointer-events-none transition-all duration-150 animate-fade-in"
        >
          {/* Header */}
          <div className="border-b border-slate-800 pb-1.5 mb-2">
            <h4 className="text-xs font-bold text-slate-100 truncate">{objectNaam}</h4>
            <div className="flex justify-between items-center text-[9px] text-slate-400">
              <span className="font-mono text-emerald-400 uppercase">{objectType}</span>
              <span className="text-[8px]">ID: {objectId.slice(0, 8)}...</span>
            </div>
          </div>

          {/* Body met metingen */}
          <div className="space-y-1.5 text-[11px]">
            {loading ? (
              <div className="py-2 text-center text-slate-500 italic">
                Data ophalen...
              </div>
            ) : metingen.length === 0 ? (
              <div className="py-2 text-center text-slate-500 italic">
                Geen actieve metingen bekend
              </div>
            ) : (
              metingen.map((m) => (
                <div key={m.parameterId} className="flex justify-between items-start gap-2 py-0.5">
                  <span className="text-slate-400 truncate max-w-30" title={m.parameterNaam}>
                    {m.parameterNaam}
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-900/30">
                      {m.waarde} {m.dataType === "numeriek" && m.eenheidId}
                    </span>
                    <p className="text-[8px] text-slate-500 font-light mt-0.5">
                      {new Date(m.tijdstipUtc).toLocaleDateString("nl-NL", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}