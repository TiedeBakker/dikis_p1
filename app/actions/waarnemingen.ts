"use server";

import { db } from "@/db";
// Geüpdatet naar 'metingen' uit je schema
import { metingen, parameterSetLijnen, parameterDefinities } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// 1. Haal de formulier-velden (parameters) op die bij een specifieke set horen
export async function getFormulierVeldenVoorSet(parameterSetId: string) {
  if (!parameterSetId) return [];
  
  return await db
    .select({
      parameterId: parameterSetLijnen.parameterId,
      volgorde: parameterSetLijnen.volgorde,
      naam: parameterDefinities.naam,
      dataType: parameterDefinities.dataType,
      helpTekst: parameterDefinities.helpTekst,
      keuzeOpties: parameterDefinities.keuzeOpties,
      eenheidId: parameterDefinities.eenheidId,
    })
    .from(parameterSetLijnen)
    .innerJoin(parameterDefinities, eq(parameterSetLijnen.parameterId, parameterDefinities.id))
    .where(eq(parameterSetLijnen.parameterSetId, parameterSetId))
    .orderBy(asc(parameterSetLijnen.volgorde));
}

// 2. Sla een batch aan metingen op in de juiste tabel
export async function createWaarnemingenAction(
  objectId: string,
  fieldsData: { parameterId: string; waarde: string }[]
) {
  if (!objectId || fieldsData.length === 0) {
    return { success: false, message: "Object en ingevulde velden zijn verplicht." };
  }

  try {
    const nuUtc = new Date().toISOString();

    // Mapping naar de exacte tabel 'metingen' en kolom 'tijdstipUtc'
    const insertValues = fieldsData
      .filter(f => f.waarde !== undefined && f.waarde !== "") 
      .map(f => ({
        objectId,
        parameterId: f.parameterId,
        waarde: f.waarde,
        tijdstipUtc: nuUtc, // Exact conform schema
        // ingevoerdDoorObjectId: ... (kunnen we later vullen als we authenticatie/sessies linken aan een object)
      }));

    if (insertValues.length === 0) {
      return { success: false, message: "Vul tenminste één waarde in." };
    }

    // Insert in 'metingen'
    await db.insert(metingen).values(insertValues);

    revalidatePath("/registratie");
    return { success: true, message: `Succesvol ${insertValues.length} meting(en) geregistreerd!` };
  } catch (error) {
    console.error("Fout bij opslaan metingen:", error);
    return { success: false, message: "Databasefout bij het opslaan van de metingen." };
  }
}

// 3. Haal de laatste metingen historie op
export async function getWaarnemingenHistorie(objectId?: string) {
  try {
    let query = db
      .select({
        id: metingen.id,
        objectId: metingen.objectId,
        parameterId: metingen.parameterId,
        waarde: metingen.waarde,
        tijdstipUtc: metingen.tijdstipUtc, // Exact conform schema
        parameterNaam: parameterDefinities.naam,
        dataType: parameterDefinities.dataType
      })
      .from(metingen)
      .innerJoin(parameterDefinities, eq(metingen.parameterId, parameterDefinities.id));

    if (objectId) {
      // @ts-ignore
      query = query.where(eq(metingen.objectId, objectId));
    }

    // Toon de nieuwste metingen bovenaan
    return await query.orderBy(desc(metingen.tijdstipUtc)).limit(30);
  } catch (error) {
    console.error("Fout bij ophalen historie:", error);
    return [];
  }
}

// 4. Haal álle beschikbare parameters op voor de losse selectie-dropdown
export async function getAlleParameterDefinities() {
  try {
    return await db
      .select({
        id: parameterDefinities.id,
        naam: parameterDefinities.naam,
        dataType: parameterDefinities.dataType,
        helpTekst: parameterDefinities.helpTekst,
        keuzeOpties: parameterDefinities.keuzeOpties,
        eenheidId: parameterDefinities.eenheidId,
      })
      .from(parameterDefinities)
      .orderBy(asc(parameterDefinities.naam));
  } catch (error) {
    console.error("Fout bij ophalen parameterdefinities:", error);
    return [];
  }
}