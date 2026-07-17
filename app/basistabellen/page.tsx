import { getBasistabellenData } from "@/app/actions/basistabellen";
import { db } from "@/db";
import { parameterDefinities } from "@/db/schema";
import BasistabellenDashboard from "./BasistabellenDashboard";

export const revalidate = 0;

export default async function BasistabellenPage() {
  const data = await getBasistabellenData();

  // Haal alle beschikbare parameterdefinities op uit de database voor de koppeling
  const parameters = await db
    .select({
      id: parameterDefinities.id,
      naam: parameterDefinities.naam,
      dataType: parameterDefinities.dataType,
    })
    .from(parameterDefinities);

  // Map ze hier alvast veilig om null-IDs uit te sluiten
  const veiligeParameters = parameters
    .filter(p => p.id !== null)
    .map(p => ({
      id: p.id as string,
      naam: p.naam,
      dataType: p.dataType
    }));
  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Basistabellen Beheer
        </h1>
        <p className="text-sm text-slate-500">
          Beheer de stamdata, referentielijsten en de formulier-indelingen van het systeem.
        </p>
      </header>

      <BasistabellenDashboard
        initialData={data}
        alleParameters={parameters}
      />
    </div>
  );
}