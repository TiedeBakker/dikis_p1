import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          DIKIS v3 Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Universeel, metadata-gestuurd kennissysteem. Alles is een object.
        </p>
      </header>

      {/* Grid met snelle snelkoppelingen voor mobiel/tablet */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link 
          href="/objecten" 
          className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-500 transition-all group"
        >
          <h2 className="font-bold text-lg text-slate-800 group-hover:text-blue-600">
            Objectbeheer →
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Aanmaken van entiteiten, personen en het leggen van gerichte netwerkrelaties.
          </p>
        </Link>

        <Link 
          href="/parameters" 
          className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-500 transition-all group"
        >
          <h2 className="font-bold text-lg text-slate-800 group-hover:text-blue-600">
            Parameters & Sets →
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Beheer parameterdefinities, datatypen en bundel ze in logische sets.
          </p>
        </Link>

        <Link 
          href="/basistabellen" 
          className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-500 transition-all group"
        >
          <h2 className="font-bold text-lg text-slate-800 group-hover:text-blue-600">
            Basistabellen →
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Beheer van de harde stamlijsten zoals Objecttypen, Eenheden en Relatietypen.
          </p>
        </Link>

        <Link 
          href="/koppelingen" 
          className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-500 transition-all group"
        >
          <h2 className="font-bold text-lg text-slate-800 group-hover:text-blue-600">
            Koppelingen →
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Koppel parametersets aan objecttypen of specifieke objectoverrides.
          </p>
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <span className="font-bold">Systeemstatus:</span> Fundering actief. Stamlijsten succesvol gesynchroniseerd in Turso.
      </div>
    </div>
  );
}