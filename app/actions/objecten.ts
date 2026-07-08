"use server";

import { db } from "@/db";
import { objecten, objectTypen } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { objectRelaties, relatieTypen } from "@/db/schema";
import { eq, and, asc, desc, like, isNull } from "drizzle-orm";

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
            conditions.push(like(objecten.weergaveNaam, `%${filters.zoekterm}%`));
        }

        // Pas de condities toe als ze er zijn
        if (conditions.length > 0) {
            // @ts-ignore - Drizzle dynamic where workaround
            query = query.where(and(...conditions));
        }

        // Sorteer op nieuwste eerst en kap af op de top 20 meest relevante resultaten
        return await query
            .orderBy(desc(objecten.createdAt))
            .limit(20);

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
export async function getObjectHierarchie(objectId: string) {
  try {
    const ouders = await db
      .select({
        relatieId: objectRelaties.id,
        volgorde: objectRelaties.volgorde,
        relatieType: relatieTypen.omschrijving,
        ouderId: objecten.id,
        ouderNaam: objecten.weergaveNaam,
        ouderType: objecten.type,
      })
      .from(objectRelaties)
      .innerJoin(objecten, eq(objectRelaties.vanObjectId, objecten.id))
      .innerJoin(relatieTypen, eq(objectRelaties.relatieTypeId, relatieTypen.id))
      .where(
        and(
          eq(objectRelaties.naarObjectId, objectId),
          isNull(objectRelaties.validUntil) // <-- Alleen actuele relaties
        )
      );

    const kinderen = await db
      .select({
        relatieId: objectRelaties.id,
        volgorde: objectRelaties.volgorde,
        relatieType: relatieTypen.omschrijving,
        kindId: objecten.id,
        kindNaam: objecten.weergaveNaam,
        kindType: objecten.type,
      })
      .from(objectRelaties)
      .innerJoin(objecten, eq(objectRelaties.naarObjectId, objecten.id))
      .innerJoin(relatieTypen, eq(objectRelaties.relatieTypeId, relatieTypen.id))
      .where(
        and(
          eq(objectRelaties.vanObjectId, objectId),
          isNull(objectRelaties.validUntil) // <-- Alleen actuele relaties
        )
      )
      .orderBy(asc(objectRelaties.volgorde));

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