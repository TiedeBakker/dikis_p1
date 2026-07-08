import { getBasistabellenData } from "@/app/actions/basistabellen";
import BasistabellenDashboard from "./BasistabellenDashboard";

export const revalidate = 0;

export default async function BasistabellenPage() {
  const data = await getBasistabellenData();

  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Basistabellen Beheer
        </h1>
        <p className="text-sm text-slate-500">
          Beheer de stamdata en referentielijsten (Objecttypen, Relatietypen en Meeteenheden) van het systeem.
        </p>
      </header>

      <BasistabellenDashboard initialData={data} />
    </div>
  );
}