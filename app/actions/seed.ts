"use server";

import { db } from "@/db"; // Jouw Drizzle db instantie
import { eenheden, objectTypen, relatieTypen } from "@/db/schema";
import { SEED_EENHEDEN, SEED_OBJECT_TYPEN, SEED_RELATIE_TYPEN } from "@/db/seedData";

export interface SeedResult {
  success: boolean;
  message: string;
  details?: string;
}

export async function seedStamlijstenAction(): Promise<SeedResult> {
  try {
    // 1. Eenheden
    await db
      .insert(eenheden)
      .values(SEED_EENHEDEN)
      .onConflictDoNothing({ target: eenheden.id });

    // 2. Object Typen
    await db
      .insert(objectTypen)
      .values(SEED_OBJECT_TYPEN)
      .onConflictDoNothing({ target: objectTypen.id });

    // 3. Relatie Typen
    await db
      .insert(relatieTypen)
      .values(SEED_RELATIE_TYPEN)
      .onConflictDoNothing({ target: relatieTypen.id });

    return {
      success: true,
      message: "Stamlijsten succesvol gesynchroniseerd/geseed!",
    };
  } catch (error) {
    console.error("Seed fout:", error);
    return {
      success: false,
      message: "Er is iets misgegaan tijdens het seeden.",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}