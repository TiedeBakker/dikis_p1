import { getObjectTypen, getObjecten, getRelatieTypen } from "@/app/actions/objecten";
import ObjectenMainTabs from "./ObjectenMainTabs";

export const revalidate = 0;

export default async function ObjectenPage() {
  const objectTypen = await getObjectTypen();
  const initialObjecten = await getObjecten();
  const relatieTypen = await getRelatieTypen(); // <-- Nieuw

  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Objectbeheer</h1>
        <p className="text-sm text-slate-500">Beheer universele entiteiten en hun onderlinge netwerkrelaties.</p>
      </header>

      {/* Geef relatieTypen mee */}
      <ObjectenMainTabs 
        objectTypen={objectTypen} 
        initialObjecten={initialObjecten} 
        relatieTypen={relatieTypen} 
      />
    </div>
  );
}