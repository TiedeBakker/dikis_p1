import { 
  getParameterDefinities, 
  getParameterSets, 
  getEenheden 
} from "@/app/actions/parameters";
import ParametersMainTabs from "./ParametersMainTabs";

export const revalidate = 0;

export default async function ParametersPage() {
  const definities = await getParameterDefinities();
  const sets = await getParameterSets();
  const eenheden = await getEenheden();

  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Parameter & Set Beheer
        </h1>
        <p className="text-sm text-slate-500">
          Definieer de datavelden en bundel ze in logische sets voor formulieren.
        </p>
      </header>

      <ParametersMainTabs 
        definities={definities} 
        sets={sets} 
        eenheden={eenheden} 
      />
    </div>
  );
}