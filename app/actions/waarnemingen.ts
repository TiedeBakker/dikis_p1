//app/actions/waarnemingen.ts
"use server";

import { db } from "@/db";
// Geüpdatet naar 'metingen' uit je schema
import { metingen, parameterSetLijnen, parameterDefinities } from "@/db/schema";
import { eq, asc, desc, and, inArray, lte } from "drizzle-orm";
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
  fieldsData: { parameterId: string; waarde: string }[],
  handmatigTijdstip?: string // Derde optionele parameter toegevoegd
) {
  if (!objectId || fieldsData.length === 0) {
    return { success: false, message: "Object en ingevulde velden zijn verplicht." };
  }

  try {
    // Als er een handmatig tijdstip is meegegeven, converteren we dit naar UTC.
    // Zo niet, dan gebruiken we de huidige tijd (fallback).
    const tijdstipUtc = handmatigTijdstip
      ? new Date(handmatigTijdstip).toISOString()
      : new Date().toISOString();

    // Mapping naar de exacte tabel 'metingen' en kolom 'tijdstipUtc'
    const insertValues = fieldsData
      .filter(f => f.waarde !== undefined && f.waarde !== "")
      .map(f => ({
        objectId,
        parameterId: f.parameterId,
        waarde: f.waarde,
        tijdstipUtc: tijdstipUtc, // Gebruikt nu het (historische) dynamische tijdstip
        // ingevoerdDoorObjectId: ...
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


// Geüpdatete versie van de action:
export async function getLaatsteWaardenVoorObjectAction(
  objectId: string,
  parameterIds: string[],
  totTijdstipUtc?: string // <-- NIEUW: Optionele tijdsgrens
) {
  if (!objectId || parameterIds.length === 0) return {};

  try {
    // Basisvoorwaarden (object en parameters)
    const conditions = [
      eq(metingen.objectId, objectId),
      inArray(metingen.parameterId, parameterIds)
    ];

    // NIEUW: Als er een tijdsgrens is meegegeven, kijken we alleen naar metingen
    // die VÓÓR of EXACT op dat moment zijn gedaan.
    if (totTijdstipUtc) {
      conditions.push(lte(metingen.tijdstipUtc, totTijdstipUtc));
    }

    const resultaten = await db
      .select({
        parameterId: metingen.parameterId,
        waarde: metingen.waarde,
        tijdstipUtc: metingen.tijdstipUtc,
      })
      .from(metingen)
      .where(and(...conditions)) // dynamically spread de condities
      .orderBy(desc(metingen.tijdstipUtc));

    const laatsteWaardenMap: Record<string, { waarde: string; tijdstipUtc: string }> = {};
    
    for (const meting of resultaten) {
      if (!laatsteWaardenMap[meting.parameterId]) {
        laatsteWaardenMap[meting.parameterId] = {
          waarde: meting.waarde,
          tijdstipUtc: meting.tijdstipUtc,
        };
      }
    }

    return laatsteWaardenMap;
  } catch (error) {
    console.error("Fout bij ophalen laatste waarden:", error);
    return {};
  }
}



/// 6. Corrigeer een specifieke meting op basis van zijn ID (EAV) - Nu inclusief tijdstip-correctie!
export async function updateWaarnemingAction(
  id: string, 
  nieuweWaarde: string,
  nieuwTijdstipLokaal?: string // <-- NIEUW: Optioneel aanpasbaar tijdstip
) {
  if (!id) {
    return { success: false, message: "Meting ID is verplicht voor een correctie." };
  }

  try {
    const updateData: Record<string, any> = {
      waarde: nieuweWaarde
    };

    // Als de gebruiker het tijdstip heeft aangepast, converteren we dit netjes naar UTC
    if (nieuwTijdstipLokaal) {
      updateData.tijdstipUtc = new Date(nieuwTijdstipLokaal).toISOString();
    }

    // Voer de update uit op de tabel 'metingen'
    await db
      .update(metingen)
      .set(updateData)
      .where(eq(metingen.id, id));

    // Revalidate de registratie-route om direct de nieuwe waarden en tijden te tonen
    revalidatePath("/registratie");

    return { 
      success: true, 
      message: "De meting (en het tijdstip) is succesvol gecorrigeerd!" 
    };
  } catch (error) {
    console.error("Fout bij corrigeren van waarneming:", error);
    return { 
      success: false, 
      message: "Databasefout bij het corrigeren van de meting." 
    };
  }
}
// app/actions/waarnemingen.ts

// Haal de allerlaatste waarden op van álle parameters die ooit voor dit object zijn gemeten
export async function getLaatsteMetingenVoorObject(objectId: string) {
  if (!objectId) return [];

  try {
    // We halen alle unieke metingen op, gesorteerd op tijdstip, 
    // en filteren in de applicatie (of via SQL) op de nieuwste per parameter.
    const resultaten = await db
      .select({
        id: metingen.id,
        parameterId: metingen.parameterId,
        parameterNaam: parameterDefinities.naam,
        waarde: metingen.waarde,
        tijdstipUtc: metingen.tijdstipUtc,
        eenheidId: parameterDefinities.eenheidId,
        dataType: parameterDefinities.dataType,
      })
      .from(metingen)
      .innerJoin(parameterDefinities, eq(metingen.parameterId, parameterDefinities.id))
      .where(eq(metingen.objectId, objectId))
      .orderBy(desc(metingen.tijdstipUtc));

    // Filter handmatig op de unieke laatste meting per parameterId
    const uniekeLaatste: Record<string, typeof resultaten[number]> = {};
    for (const r of resultaten) {
      if (!uniekeLaatste[r.parameterId]) {
        uniekeLaatste[r.parameterId] = r;
      }
    }

    return Object.values(uniekeLaatste);
  } catch (error) {
    console.error("Fout bij ophalen laatste metingen voor object:", error);
    return [];
  }
}