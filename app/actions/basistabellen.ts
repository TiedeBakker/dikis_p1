"use server";

import { db } from "@/db";
import { objectTypen, relatieTypen, eenheden } from "@/db/schema";
import { asc, like, or, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- 1. OPHALEN DATA ---
export async function getBasistabellenData(zoekterm?: string) {
  try {
    let objQuery = db.select().from(objectTypen);
    let relQuery = db.select().from(relatieTypen);
    let eenQuery = db.select().from(eenheden);

    if (zoekterm) {
      const wildcard = `%${zoekterm}%`;
      // @ts-ignore
      objQuery = objQuery.where(or(like(objectTypen.id, wildcard), like(objectTypen.omschrijving, wildcard)));
      // @ts-ignore
      relQuery = relQuery.where(or(like(relatieTypen.id, wildcard), like(relatieTypen.omschrijving, wildcard)));
      // @ts-ignore
      eenQuery = eenQuery.where(or(like(eenheden.id, wildcard), like(eenheden.omschrijving, wildcard)));
    }

    const [typen, relaties, meeteenheden] = await Promise.all([
      objQuery.orderBy(asc(objectTypen.omschrijving)),
      relQuery.orderBy(asc(relatieTypen.omschrijving)),
      eenQuery.orderBy(asc(eenheden.omschrijving))
    ]);

    return { typen, relaties, meeteenheden };
  } catch (error) {
    console.error("Fout bij ophalen basistabellen:", error);
    return { typen: [], relaties: [], meeteenheden: [] };
  }
}

// --- 2. TOEVOEGEN DATA ---
export async function createBasistabelItemAction(tabel: "object" | "relatie" | "eenheid", formData: FormData) {
  const id = formData.get("id") as string;
  const omschrijving = formData.get("omschrijving") as string;
  const symbool = formData.get("symbool") as string || ""; // Vang het symbool op
  const toelichting = formData.get("toelichting") as string || ""; // Vang de toelichting op

  if (!id || !omschrijving) {
    return { success: false, message: "Code (ID) en Omschrijving zijn verplicht." };
  }

  if (tabel === "eenheid" && !symbool) {
    return { success: false, message: "Voor een meeteenheid is een symbool (bijv. °C of mm) verplicht." };
  }

  const cleanId = id.trim().toLowerCase().replace(/\s+/g, "_");

  try {
    if (tabel === "object") {
      await db.insert(objectTypen).values({ id, omschrijving, toelichting });
    } else if (tabel === "relatie") {
      await db.insert(relatieTypen).values({ id, omschrijving, toelichting });
    } else if (tabel === "eenheid") {
      // TypeScript is nu blij, want symbool wordt meegeleverd!
      await db.insert(eenheden).values({ id: cleanId, omschrijving, symbool });
    }

    revalidatePath("/basistabellen");
    return { success: true, message: "Item succesvol toegevoegd aan de basistabel!" };
  } catch (error) {
    console.error(error);
    return { success: false, message: `Databasefout. Bestaat de code '${cleanId}' al?` };
  }
}
// --- 3. WIJZIGEN DATA ---
export async function updateBasistabelItemAction(
  tabel: "object" | "relatie" | "eenheid",
  id: string,
  formData: FormData
) {
  const omschrijving = formData.get("omschrijving") as string;
  const symbool = formData.get("symbool") as string || "";
  const toelichting = formData.get("toelichting") as string || "";

  if (!omschrijving) {
    return { success: false, message: "Omschrijving is verplicht." };
  }

  if (tabel === "eenheid" && !symbool) {
    return { success: false, message: "Voor een meeteenheid is een symbool verplicht." };
  }

  try {
    if (tabel === "object") {
      await db.update(objectTypen).set({ omschrijving, toelichting }).where(eq(objectTypen.id, id));
    } else if (tabel === "relatie") {
      await db.update(relatieTypen).set({ omschrijving, toelichting }).where(eq(relatieTypen.id, id));
    } else if (tabel === "eenheid") {
      await db.update(eenheden).set({ omschrijving, symbool }).where(eq(eenheden.id, id));
    }

    revalidatePath("/basistabellen");
    return { success: true, message: "Item succesvol bijgewerkt!" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Databasefout tijdens het bijwerken." };
  }
}