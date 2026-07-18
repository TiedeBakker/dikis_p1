// src/app/admin/seed/page.tsx
export const dynamic = "force-dynamic";
"use client";

import { useState, useTransition } from "react";
import { seedStamlijstenAction, type SeedResult } from "@/app/actions/seed";

export default function SeedPage() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SeedResult | null>(null);

  const handleSeed = () => {
    setResult(null);
    startTransition(async () => {
      const res = await seedStamlijstenAction();
      setResult(res);
    });
  };

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">DIKIS v3 - Systeem Initialisatie</h1>
      <p className="text-sm text-gray-600">
        Klik op de onderstaande knop om de universele basis-stamlijsten in Turso te schieten.
      </p>

      <button
        onClick={handleSeed}
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded disabled:bg-gray-400"
      >
        {isPending ? "Seeden..." : "Start Database Seed"}
      </button>

      {result && (
        <div className={`p-4 rounded text-sm ${result.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          <p className="font-semibold">{result.message}</p>
          {result.details && <p className="text-xs mt-1 font-mono">{result.details}</p>}
        </div>
      )}
    </div>
  );
}