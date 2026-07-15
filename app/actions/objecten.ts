// app/actions/objecten.ts
"use server";

import { db } from "@/db";
import {objecten, objectTypen, objectRelaties, relatieTypen, metingen } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and, asc, desc, like, isNull, or } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm"; // Zorg dat deze bovenin geïmporteerd staat

// 1. Haal alle beschikbare objecttypen op (voor het aanmaakformulier)
export async function getObjectTypen() {
  try {
    return await db.select().from(objectTypen);
  } catch (error) {
    console.error("Fout bij ophalen objecttypen:", error);
    return [];
  }
}

// 2. Geoptimaliseerd ophalen met filters en een harde LIMIT
export async function getObjecten(filters?: { type?: string; zoekterm?: string }) {
  try {
    let query = db.select().from(objecten);
    const conditions = [];

    // Filter op ObjectType indien geselecteerd
    if (filters?.type) {
      conditions.push(eq(objecten.type, filters.type));
    }

    // Filter op naam (case-insensitive wildcards via %zoekterm%)
    if (filters?.zoekterm) {
      //conditions.push(like(objecten.weergaveNaam, `%${filters.zoekterm}%`));
      conditions.push(like(objecten.weergaveNaam, `${filters.zoekterm}%`));
    }

    // Pas de condities toe als ze er zijn
    if (conditions.length > 0) {
      // @ts-ignore - Drizzle dynamic where workaround
      query = query.where(and(...conditions));
    }


    return await query
      .orderBy(asc(objecten.weergaveNaam)) // <-- Veranderd van desc(createdAt) naar asc(weergaveNaam)
      .limit(25);
  } catch (error) {
    console.error("Fout bij ophalen gefilterde objecten:", error);
    return [];
  }
}

// 3. Maak een gloednieuw universeel object aan
export async function createObjectAction(formData: FormData) {
  const type = formData.get("type") as string;
  const weergaveNaam = formData.get("weergaveNaam") as string;

  if (!type || !weergaveNaam) {
    return { success: false, message: "Type en Weergavenaam zijn verplicht." };
  }

  try {
    await db.insert(objecten).values({
      type,
      weergaveNaam,
    });

    // Zorg dat Next.js de data direct ververst op de pagina
    revalidatePath("/objecten");
    return { success: true, message: "Object succesvol aangemaakt!" };
  } catch (error) {
    console.error("Fout bij object creatie:", error);
    return { success: false, message: "Databasefout bij aanmaken object." };
  }
}

// 4. Haal alle beschikbare relatietypen op
export async function getRelatieTypen() {
  try {
    return await db.select().from(relatieTypen);
  } catch (error) {
    console.error("Fout bij ophalen relatietypen:", error);
    return [];
  }
}

// 5. Leg een relatie (edge) tussen twee objecten

export async function createObjectRelatieAction(formData: FormData) {
  const vanObjectId = formData.get("vanObjectId") as string;
  const naarObjectId = formData.get("naarObjectId") as string;
  const relatieTypeId = formData.get("relatieTypeId") as string;
  const volgordeRaw = formData.get("volgorde") as string;

  if (!vanObjectId || !naarObjectId || !relatieTypeId) {
    return { success: false, message: "Van, Naar en Relatietype zijn verplicht." };
  }

  if (vanObjectId === naarObjectId) {
    return { success: false, message: "Een object kan geen relatie met zichzelf hebben." };
  }

  try {
    // CHECK: Bestaat exact deze relatie al?
    const bestaandeRelatie = await db
      .select()
      .from(objectRelaties)
      .where(
        and(
          eq(objectRelaties.vanObjectId, vanObjectId),
          eq(objectRelaties.naarObjectId, naarObjectId),
          eq(objectRelaties.relatieTypeId, relatieTypeId)
        )
      )
      .limit(1);

    if (bestaandeRelatie.length > 0) {
      return { success: false, message: "Deze specifieke relatie bestaat al tussen deze objecten!" };
    }

    const volgorde = volgordeRaw ? parseInt(volgordeRaw, 10) : 0;

    await db.insert(objectRelaties).values({
      vanObjectId,
      naarObjectId,
      relatieTypeId,
      volgorde,
    });

    revalidatePath("/objecten");
    return { success: true, message: "Relatie succesvol vastgelegd!" };
  } catch (error) {
    console.error("Fout bij aanmaken relatie:", error);
    return { success: false, message: "Databasefout bij aanmaken relatie." };
  }
}
// 6. Update een bestaand object (Naam wijzigen)
export async function updateObjectAction(id: string, formData: FormData) {
  const weergaveNaam = formData.get("weergaveNaam") as string;
  const type = formData.get("type") as string;

  if (!weergaveNaam || !type) {
    return { success: false, message: "Naam en type zijn verplicht." };
  }

  try {
    await db
      .update(objecten)
      .set({ weergaveNaam, type })
      .where(eq(objecten.id, id));

    revalidatePath("/objecten");
    return { success: true, message: "Object succesvol bijgewerkt!" };
  } catch (error) {
    console.error("Fout bij updaten object:", error);
    return { success: false, message: "Databasefout bij bijwerken." };
  }
}

// 7. Haal de actuele hiërarchie op (filter op validUntil is NULL)
// PAS NU HIERARCHIE AAN (Zodat createdAt, validUntil en toelichting worden meegegeven)
// app/actions/objecten.ts

// Zorg dat deze imports bovenaan staan (inclusief metingen en aliasedTable):
// import { objecten, objectTypen, objectRelaties, relatieTypen, metingen } from "@/db/schema";
// import { aliasedTable } from "drizzle-orm";

export async function getObjectHierarchie(objectId: string) {
  try {
    // Aliases voor joins om conflicten te voorkomen
    const metingenNl = aliasedTable(metingen, "metingen_nl");

    // 1. Haal alle OUDERS op (waar dit object het KIND van is)
    const ouders = await db
      .select({
        relatieId: objectRelaties.id,
        volgorde: objectRelaties.volgorde,
        relatieType: relatieTypen.omschrijving,
        createdAt: objectRelaties.createdAt,
        validUntil: objectRelaties.validUntil,
        toelichting: objectRelaties.toelichting,
        
        // Gegevens van de ouder (uniforme keys voor de frontend)
        id: objecten.id,
        weergaveNaam: objecten.weergaveNaam,
        type: objecten.type,
        typeOmschrijving: objectTypen.omschrijving, // <-- Join met objectTypen toegevoegd!
        nederlandseNaam: metingenNl.waarde,         // <-- Join met metingen toegevoegd!
      })
      .from(objectRelaties)
      .innerJoin(objecten, eq(objectRelaties.vanObjectId, objecten.id))
      .innerJoin(relatieTypen, eq(objectRelaties.relatieTypeId, relatieTypen.id))
      .leftJoin(objectTypen, eq(objecten.type, objectTypen.id))
      .leftJoin(
        metingenNl,
        and(
          eq(metingenNl.objectId, objecten.id),
          eq(metingenNl.parameterId, "naam_nl")
        )
      )
      .where(
        and(
          eq(objectRelaties.naarObjectId, objectId),
          isNull(objectRelaties.validUntil)
        )
      )
      .orderBy(asc(objectRelaties.volgorde), asc(objecten.weergaveNaam));

    // 2. Haal alle KINDEREN op (waar dit object de OUDER van is)
    const kinderen = await db
      .select({
        relatieId: objectRelaties.id,
        volgorde: objectRelaties.volgorde,
        relatieType: relatieTypen.omschrijving,
        createdAt: objectRelaties.createdAt,
        validUntil: objectRelaties.validUntil,
        toelichting: objectRelaties.toelichting,
        
        // Gegevens van het kind (uniforme keys voor de frontend)
        id: objecten.id,
        weergaveNaam: objecten.weergaveNaam,
        type: objecten.type,
        typeOmschrijving: objectTypen.omschrijving, // <-- Join met objectTypen toegevoegd!
        nederlandseNaam: metingenNl.waarde,         // <-- Join met metingen toegevoegd!
      })
      .from(objectRelaties)
      .innerJoin(objecten, eq(objectRelaties.naarObjectId, objecten.id))
      .innerJoin(relatieTypen, eq(objectRelaties.relatieTypeId, relatieTypen.id))
      .leftJoin(objectTypen, eq(objecten.type, objectTypen.id))
      .leftJoin(
        metingenNl,
        and(
          eq(metingenNl.objectId, objecten.id),
          eq(metingenNl.parameterId, "naam_nl")
        )
      )
      .where(
        and(
          eq(objectRelaties.vanObjectId, objectId),
          isNull(objectRelaties.validUntil)
        )
      )
      .orderBy(asc(objectRelaties.volgorde), asc(objecten.weergaveNaam));

    return { ouders, kinderen };
  } catch (error) {
    console.error("Fout bij ophalen hiërarchie:", error);
    return { ouders: [], kinderen: [] };
  }
}
// 8. Update de volgorde-index van een bestaande relatie (edge)
export async function updateRelatieVolgordeAction(relatieId: string, nieuweVolgorde: number) {
  try {
    await db
      .update(objectRelaties)
      .set({ volgorde: nieuweVolgorde })
      .where(eq(objectRelaties.id, relatieId));

    revalidatePath("/objecten");
    return { success: true, message: "Volgorde bijgewerkt!" };
  } catch (error) {
    console.error("Fout bij updaten volgorde:", error);
    return { success: false, message: "Fout bij bijwerken volgorde." };
  }
}
// 9. Relatie ontkoppelen (Zachte beëindiging via validUntil)
export async function terminateRelatieAction(relatieId: string) {
  try {
    await db
      .update(objectRelaties)
      .set({
        validUntil: new Date().toISOString() // Zet de einddatum op NU
      })
      .where(eq(objectRelaties.id, relatieId));

    revalidatePath("/objecten");
    return { success: true, message: "Relatie succesvol beëindigd." };
  } catch (error) {
    console.error("Fout bij ontkoppelen relatie:", error);
    return { success: false, message: "Fout bij ontkoppelen." };
  }
}
// 10. Bulk aanmaken en koppelen van kinderen aan een parent
export async function createBulkChildrenAction(formData: FormData) {
  const vanObjectId = formData.get("vanObjectId") as string; // De Ouder
  const kindObjectType = formData.get("kindObjectType") as string; // Bijv: 'kast' of 'insect'
  const basisNaam = formData.get("basisNaam") as string; // Bijv: 'Plank' of 'Specimen'
  const relatieTypeId = formData.get("relatieTypeId") as string; // Bijv: 'fysiek_onderdeel_van'
  const aantalRaw = formData.get("aantal") as string;
  const startVolgordeRaw = formData.get("startVolgorde") as string;

  if (!vanObjectId || !kindObjectType || !basisNaam || !relatieTypeId || !aantalRaw) {
    return { success: false, message: "Alle velden zijn verplicht voor bulk aanmaak." };
  }

  const aantal = parseInt(aantalRaw, 10);
  const startVolgorde = startVolgordeRaw ? parseInt(startVolgordeRaw, 10) : 1;

  if (aantal < 1 || aantal > 50) {
    return { success: false, message: "Aantal moet tussen de 1 en 50 liggen per batch." };
  }

  try {
    // We voeren dit uit binnen een database transactie
    await db.transaction(async (tx) => {
      for (let i = 0; i < aantal; i++) {
        const huidigeVolgorde = startVolgorde + i;
        const uniekeWeergaveNaam = `${basisNaam} ${huidigeVolgorde}`;

        // A. Maak het kind-object aan
        // Omdat we UUID's genereren via de defaultFn, moeten we hier handmatig eentje genereren voor de link
        // of we gebruiken de SQL returning syntax van Drizzle (ondersteund door Turso/SQLite)
        const [nieuwKind] = await tx
          .insert(objecten)
          .values({
            type: kindObjectType,
            weergaveNaam: uniekeWeergaveNaam,
          })
          .returning({ id: objecten.id });

        // B. Leg direct de relatie vanaf de ouder naar dit nieuwe kind
        await tx.insert(objectRelaties).values({
          vanObjectId: vanObjectId,
          naarObjectId: nieuwKind.id,
          relatieTypeId: relatieTypeId,
          volgorde: huidigeVolgorde,
        });
      }
    });

    revalidatePath("/objecten");
    return { success: true, message: `${aantal} objecten succesvol gegenereerd en gekoppeld!` };
  } catch (error) {
    console.error("Bulk aanmaak fout:", error);
    return { success: false, message: "Fout tijdens bulk-transactie in de database." };
  }
}
export async function searchObjectenAction(zoekterm: string) {
  if (!zoekterm || zoekterm.trim().length < 2) return [];

  try {
    return await db
      .select()
      .from(objecten)
      .where(
        or(
          like(objecten.weergaveNaam, `%${zoekterm}%`),
          like(objecten.id, `%${zoekterm}%`)
        )
      )
      .orderBy(asc(objecten.weergaveNaam))
      .limit(20); // Limiet is hier GOED, want het is het resultaat v/d zoekopdracht
  } catch (error) {
    console.error("Fout bij zoeken van objecten:", error);
    return [];
  }
}

// Voeg deze action toe (bijvoorbeeld onder nummer 9 of 10)
export async function updateRelatieDetailsAction(
  relatieId: string,
  formData: FormData
) {
  const createdAt = formData.get("createdAt") as string;
  const validUntilRaw = formData.get("validUntil") as string;
  const toelichting = formData.get("toelichting") as string;

  if (!createdAt) {
    return { success: false, message: "Aanmaakdatum is verplicht." };
  }

  try {
    await db
      .update(objectRelaties)
      .set({
        createdAt: new Date(createdAt).toISOString(),
        validUntil: validUntilRaw ? new Date(validUntilRaw).toISOString() : null,
        toelichting: toelichting || null,
      })
      .where(eq(objectRelaties.id, relatieId));

    revalidatePath("/objecten");
    return { success: true, message: "Relatie succesvol bijgewerkt!" };
  } catch (error) {
    console.error("Fout bij updaten relatie details:", error);
    return { success: false, message: "Databasefout bij bijwerken relatie." };
  }
}
// app/actions/objecten.ts

// ... (andere imports & functies) ...

/**
 * Haalt recursief de volledige boom van ouders (ancestors) op voor de zijbalk.
 * Resultaat is gesorteerd van de absolute top-parent (wortel) naar de directe ouder.
 */
export async function getOuderBoom(objectId: string): Promise<any[]> {
  const boom: any[] = [];
  const bezochteIds = new Set<string>(); // Voorkom oneindige lussen

  async function fetchOudersRecursief(currentId: string) {
    if (bezochteIds.has(currentId)) return;
    bezochteIds.add(currentId);

    const metingenNl = aliasedTable(metingen, "metingen_nl");

    // Haal de directe ouders op van het huidige niveau
    const directeOuders = await db
      .select({
        relatieId: objectRelaties.id,
        volgorde: objectRelaties.volgorde,
        relatieType: relatieTypen.omschrijving,
        id: objecten.id,
        weergaveNaam: objecten.weergaveNaam,
        type: objecten.type,
        typeOmschrijving: objectTypen.omschrijving,
        nederlandseNaam: metingenNl.waarde,
      })
      .from(objectRelaties)
      .innerJoin(objecten, eq(objectRelaties.vanObjectId, objecten.id))
      .innerJoin(relatieTypen, eq(objectRelaties.relatieTypeId, relatieTypen.id))
      .leftJoin(objectTypen, eq(objecten.type, objectTypen.id))
      .leftJoin(
        metingenNl,
        and(
          eq(metingenNl.objectId, objecten.id),
          eq(metingenNl.parameterId, "naam_nl")
        )
      )
      .where(
        and(
          eq(objectRelaties.naarObjectId, currentId),
          isNull(objectRelaties.validUntil)
        )
      );

    for (const ouder of directeOuders) {
      // Voeg de ouder toe aan onze boom
      boom.unshift(ouder); // unshift zorgt dat de oudste voorouders vooraan komen te staan!
      // Zoek recursief verder omhoog
      await fetchOudersRecursief(ouder.id);
    }
  }

  await fetchOudersRecursief(objectId);
  return boom;
}

// app/actions/objecten.ts
// ... bestaande imports en actions ...

/**
 * Specifieke server action voor de Boom Navigator (Fase 1)
 * Haalt de stamboom (ouders met snoei-logica) en directe kinderen met indicators op.
 */
export async function getBoomNavigatorData(objectId: string) {
  if (!objectId) return null;

  try {
    // 1. Haal het centrale object op
    const [centraal] = await db
      .select({
        id: objecten.id,
        weergaveNaam: objecten.weergaveNaam,
        type: objecten.type,
        typeOmschrijving: objectTypen.omschrijving,
      })
      .from(objecten)
      .leftJoin(objectTypen, eq(objecten.type, objectTypen.id))
      .where(eq(objecten.id, objectId))
      .limit(1);

    if (!centraal) return null;

    // 2. Recursieve helper om voorouders op te halen.
    // 'levelsSinceSplit' houdt bij hoeveel generaties we boven een splitsing (>= 2 ouders) zitten.
    async function fetchAncestors(currentId: string, depth: number = 0, levelsSinceSplit: number = -1): Promise<any[]> {
      if (depth > 8) return []; // Harde veiligheidslimiet tegen oneindige lussen

      const directParents = await db
        .select({
          relatieId: objectRelaties.id,
          relatieType: relatieTypen.omschrijving,
          id: objecten.id,
          weergaveNaam: objecten.weergaveNaam,
          type: objecten.type,
          typeOmschrijving: objectTypen.omschrijving,
        })
        .from(objectRelaties)
        .innerJoin(objecten, eq(objectRelaties.vanObjectId, objecten.id))
        .innerJoin(relatieTypen, eq(objectRelaties.relatieTypeId, relatieTypen.id))
        .leftJoin(objectTypen, eq(objecten.type, objectTypen.id))
        .where(
          and(
            eq(objectRelaties.naarObjectId, currentId),
            isNull(objectRelaties.validUntil)
          )
        );

      const isMultiParent = directParents.length >= 2;
      
      let nextLevelsSinceSplit = levelsSinceSplit;
      if (isMultiParent && levelsSinceSplit === -1) {
        nextLevelsSinceSplit = 0; // Splitsing begint hier!
      } else if (levelsSinceSplit !== -1) {
        nextLevelsSinceSplit = levelsSinceSplit + 1;
      }

      const parentsWithAncestors = await Promise.all(
        directParents.map(async (parent) => {
          let ancestors: any[] = [];
          
          // Als we nog geen splitsing hebben gehad (-1) óf we zijn pas 1 niveau diep vanaf de splitsing (nextLevelsSinceSplit < 1),
          // dan halen we de volgende generatie op (waardoor we max ouders & grootouders tonen vanaf de splitsing).
          const canContinue = nextLevelsSinceSplit === -1 || nextLevelsSinceSplit < 1;
          
          if (canContinue) {
            ancestors = await fetchAncestors(parent.id, depth + 1, nextLevelsSinceSplit);
          }

          return {
            ...parent,
            ouders: ancestors,
          };
        })
      );

      return parentsWithAncestors;
    }

    const oudersBoom = await fetchAncestors(objectId, 0, -1);

    // 3. Eerste generatie afstammelingen (kinderen) ophalen
    const directeKinderen = await db
      .select({
        relatieId: objectRelaties.id,
        volgorde: objectRelaties.volgorde,
        relatieType: relatieTypen.omschrijving,
        id: objecten.id,
        weergaveNaam: objecten.weergaveNaam,
        type: objecten.type,
        typeOmschrijving: objectTypen.omschrijving,
      })
      .from(objectRelaties)
      .innerJoin(objecten, eq(objectRelaties.naarObjectId, objecten.id))
      .innerJoin(relatieTypen, eq(objectRelaties.relatieTypeId, relatieTypen.id))
      .leftJoin(objectTypen, eq(objecten.type, objectTypen.id))
      .where(
        and(
          eq(objectRelaties.vanObjectId, objectId),
          isNull(objectRelaties.validUntil)
        )
      )
      .orderBy(asc(objectRelaties.volgorde), asc(objecten.weergaveNaam));

    // Voor elk kind controleren of er opvolgende generaties zijn
    const kinderenMetIndicator = await Promise.all(
      directeKinderen.map(async (kind) => {
        const [subKind] = await db
          .select({ id: objectRelaties.id })
          .from(objectRelaties)
          .where(
            and(
              eq(objectRelaties.vanObjectId, kind.id),
              isNull(objectRelaties.validUntil)
            )
          )
          .limit(1);

        return {
          ...kind,
          heeftKinderen: !!subKind,
        };
      })
    );

    return {
      centraal,
      oudersBoom,
      kinderen: kinderenMetIndicator,
    };

  } catch (error) {
    console.error("Fout bij ophalen boom navigator data:", error);
    return null;
  }
}