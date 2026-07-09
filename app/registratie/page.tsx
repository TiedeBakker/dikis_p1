//app/registratie/page.tsx
import { db } from "@/db";
import { objecten, parameterSets } from "@/db/schema";
import { asc } from "drizzle-orm";
import RegistratieDashboard from "./RegistratieDashboard";
import { getWaarnemingenHistorie, getAlleParameterDefinities } from "@/app/actions/waarnemingen";

export const revalidate = 0;

export default async function RegistratiePage() {
  const actieveObjecten = await db
    .select()
    .from(objecten)
    .orderBy(asc(objecten.weergaveNaam));

  const beschikbareSets = await db
    .select()
    .from(parameterSets)
    .orderBy(asc(parameterSets.naam));

  // NIEUW: Haal alle individuele parameters op
  const alleParameters = await getAlleParameterDefinities();
  const recenteMetingen = await getWaarnemingenHistorie();

  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Metingen Registreren
        </h1>
        <p className="text-sm text-slate-500">
          Combineer vaste parametersets met incidentele, individuele parameters voor maximale flexibiliteit in het veld.
        </p>
      </header>

      <RegistratieDashboard 
        objecten={actieveObjecten} 
        sets={beschikbareSets} 
        alleParameters={alleParameters} // Doorgeven aan Client Component
        initialHistorie={recenteMetingen}
      />
    </div>
  );
}