// app/actions/parameters.ts
"use server";

import { db } from "@/db";
import { parameterDefinities, parameterSets, parameterSetLijnen, eenheden } from "@/db/schema";
import { eq, asc, and, like} from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Haal alle eenheden op voor de dropdown
export async function getEenheden() {
  return await db.select().from(eenheden);
}

// 1. Parameter Definities Actions
// Update de ophaal-functie met filters en een top 20 limiet
export async function getParameterDefinities(filters?: { 
  dataType?: string; // Terug naar string voor UI-compatibiliteit
  zoekterm?: string;
}) {
  try {
    let query = db.select().from(parameterDefinities);
    const conditions = [];

    // Als er echt een type is ingevuld, casten we het veilig naar het juiste enum-type
    if (filters?.dataType && filters.dataType !== "") {
      conditions.push(eq(parameterDefinities.dataType, filters.dataType as any));
    }
    
    if (filters?.zoekterm) {
      conditions.push(like(parameterDefinities.naam, `%${filters.zoekterm}%`));
    }

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

   // return await query.orderBy(asc(parameterDefinities.naam)).limit(20);
    return await query.orderBy(asc(parameterDefinities.naam));
  } catch (error) {
    console.error("Fout bij ophalen parameters:", error);
    return [];
  }
}
export async function createParameterDefinitieAction(formData: FormData) {
  const id = formData.get("id") as string;
  const naam = formData.get("naam") as string;
  // TypeScript accepteert "datum" nu vlekkeloos omdat het in het schema staat!
  const dataType = formData.get("dataType") as "tekst" | "numeriek" | "keuzelijst" | "datum";
  const eenheidId = formData.get("eenheidId") as string || null;
  const helpTekst = formData.get("helpTekst") as string || null;
  const keuzeOptiesRaw = formData.get("keuzeOpties") as string;

  if (!id || !naam || !dataType) {
    return { success: false, message: "ID, Naam en Datatype zijn verplicht." };
  }

  try {
    let keuzeOpties = null;
    if (dataType === "keuzelijst" && keuzeOptiesRaw) {
      const arr = keuzeOptiesRaw.split(",").map(s => s.trim()).filter(Boolean);
      keuzeOpties = JSON.stringify(arr);
    }

    await db.insert(parameterDefinities).values({
      id, naam, dataType, eenheidId, helpTekst, keuzeOpties
    });

    revalidatePath("/parameters");
    return { success: true, message: "Parameter definitie succesvol aangemaakt!" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Databasefout. Bestaat dit ID al?" };
  }
}
// 2. Parameter Sets Actions
export async function getParameterSets() {
  return await db.select().from(parameterSets).orderBy(asc(parameterSets.naam));
}

export async function createParameterSetAction(formData: FormData) {
  const id = formData.get("id") as string;
  const naam = formData.get("naam") as string;
  const omschrijving = formData.get("omschrijving") as string || null;

  if (!id || !naam) return { success: false, message: "ID and Naam zijn verplicht." };

  try {
    await db.insert(parameterSets).values({ id, naam, omschrijving });
    revalidatePath("/parameters");
    return { success: true, message: "Parameter set succesvol aangemaakt!" };
  } catch (error) {
    return { success: false, message: "Databasefout. Bestaat dit Set ID al?" };
  }
}

// 3. Koppelen van Parameter aan Set (Lijnen)
export async function linkParameterToSetAction(formData: FormData) {
  const parameterSetId = formData.get("parameterSetId") as string;
  const parameterId = formData.get("parameterId") as string;
  const volgordeRaw = formData.get("volgorde") as string;

  if (!parameterSetId || !parameterId) return { success: false, message: "Set en Parameter zijn verplicht." };

  try {
    const volgorde = volgordeRaw ? parseInt(volgordeRaw, 10) : 10;
    await db.insert(parameterSetLijnen).values({ parameterSetId, parameterId, volgorde });
    revalidatePath("/parameters");
    return { success: true, message: "Parameter succesvol aan set toegevoegd!" };
  } catch (error) {
    return { success: false, message: "Deze parameter zit al in deze set." };
  }
}

// Haal lijnen op per set
export async function getParameterSetLijnen(setId: string) {
  return await db
    .select({
      parameterId: parameterSetLijnen.parameterId,
      volgorde: parameterSetLijnen.volgorde,
      naam: parameterDefinities.naam,
      dataType: parameterDefinities.dataType
    })
    .from(parameterSetLijnen)
    .innerJoin(parameterDefinities, eq(parameterSetLijnen.parameterId, parameterDefinities.id))
    .where(eq(parameterSetLijnen.parameterSetId, setId))
    .orderBy(asc(parameterSetLijnen.volgorde));
}
// Nieuw: Update een bestaande parameter definitie
export async function updateParameterDefinitieAction(id: string, formData: FormData) {
  const naam = formData.get("naam") as string;
  const dataType = formData.get("dataType") as "tekst" | "numeriek" | "keuzelijst" | "datum";
  const eenheidId = formData.get("eenheidId") as string || null;
  const helpTekst = formData.get("helpTekst") as string || null;
  const keuzeOptiesRaw = formData.get("keuzeOpties") as string;

  if (!naam || !dataType) {
    return { success: false, message: "Naam en Datatype zijn verplicht." };
  }

  try {
    let keuzeOpties = null;
    if (dataType === "keuzelijst" && keuzeOptiesRaw) {
      const arr = keuzeOptiesRaw.split(",").map(s => s.trim()).filter(Boolean);
      keuzeOpties = JSON.stringify(arr);
    }

    await db
      .update(parameterDefinities)
      .set({ naam, dataType, eenheidId, helpTekst, keuzeOpties })
      .where(eq(parameterDefinities.id, id));

    revalidatePath("/parameters");
    return { success: true, message: "Parameter succesvol bijgewerkt!" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Databasefout bij bijwerken parameter." };
  }
}