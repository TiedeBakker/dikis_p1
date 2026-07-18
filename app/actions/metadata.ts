export const dynamic = "force-dynamic";
"use server";

import { db } from "@/db";
import { formulierConfiguratie, parameterDefinities } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// 1. Haal alle gekoppelde parameters op voor een specifiek objecttype
export async function getFormulierConfiguratieAction(objectTypeId: string) {
  try {
    const configuratie = await db
      .select({
        id: formulierConfiguratie.id,
        objectTypeId: formulierConfiguratie.objectTypeId,
        parameterId: formulierConfiguratie.parameterId,
        volgorde: formulierConfiguratie.volgorde,
        parameterNaam: parameterDefinities.naam,
        dataType: parameterDefinities.dataType,
      })
      .from(formulierConfiguratie)
      .innerJoin(
        parameterDefinities,
        eq(formulierConfiguratie.parameterId, parameterDefinities.id)
      )
      .where(eq(formulierConfiguratie.objectTypeId, objectTypeId))
      .orderBy(asc(formulierConfiguratie.volgorde));

    return { success: true, data: configuratie };
  } catch (error) {
    console.error("Fout bij ophalen formulierconfiguratie:", error);
    return { success: false, error: "Kon configuratie niet ophalen." };
  }
}

// 2. Sla de volledige lijst met gekoppelde parameters op (en overschrijf de oude set)
export async function saveFormulierConfiguratieAction(
  objectTypeId: string,
  parameters: { parameterId: string; volgorde: number }[]
) {
  try {
    // We doen dit binnen een transactie om inconsistentie te voorkomen
    await db.transaction(async (tx) => {
      // Verwijder eerst de bestaande configuratie voor dit objecttype
      await tx
        .delete(formulierConfiguratie)
        .where(eq(formulierConfiguratie.objectTypeId, objectTypeId));

      // Als er nieuwe parameters zijn, voeg deze dan toe
      if (parameters.length > 0) {
        const rowsToInsert = parameters.map((param) => ({
          objectTypeId,
          parameterId: param.parameterId,
          volgorde: param.volgorde,
        }));
        await tx.insert(formulierConfiguratie).values(rowsToInsert);
      }
    });

    revalidatePath("/basistabellen"); // Of het pad waar je dashboard leeft
    return { success: true };
  } catch (error) {
    console.error("Fout bij opslaan formulierconfiguratie:", error);
    return { success: false, error: "Kon configuratie niet opslaan." };
  }
}