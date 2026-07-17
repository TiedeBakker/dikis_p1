"use server";

import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { db } from "@/db"; // Pas aan naar jouw DB-pad
import { objecten, objectRelaties, metingen, parameterDefinities, relatieTypen } from "@/db/schema";
import { eq, like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

interface CsvRow {
  Insectendoosnaam: string;
  soortnaam: string;
  aantal: string;
  volgnr: string;
}

function getFirstTwoWords(text: string): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]} ${words[1]}`;
  }
  return text;
}

// Veilig bestand inlezen met duidelijke foutmeldingen
function readCsvFile(): CsvRow[] {
  // We proberen het pad op twee manieren te vinden (absoluut en relatief)
  let filePath = path.join(process.cwd(), "src", "tmp.csv");
  
  if (!fs.existsSync(filePath)) {
    // Probeer fallback zonder 'src' indien de root-structuur anders is geconfigureerd
    filePath = path.join(process.cwd(), "tmp.csv");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Bestand tmp.csv kon niet worden gevonden op process.cwd(): ${process.cwd()}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<CsvRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });
  
  return parsed.data;
}

/**
 * Zorg dat de benodigde stamgegevens (FK's) bestaan om SQLite crashes te voorkomen
 */
async function ensureMetadataExists() {
  const nu = new Date().toISOString();

  // 1. Parameter 'aantal'
  const bestaandeParam = await db.select().from(parameterDefinities).where(eq(parameterDefinities.id, "aantal")).limit(1);
  if (bestaandeParam.length === 0) {
    await db.insert(parameterDefinities).values({
      id: "aantal",
      naam: "Aantal",
      dataType: "numeriek",
    });
    console.log("Stamgegeven aangemaakt: Parameter 'aantal'");
  }

  // 2. Relatietype 'behoort_bij'
  const bestaandRelatieType1 = await db.select().from(relatieTypen).where(eq(relatieTypen.id, "behoort_bij")).limit(1);
  if (bestaandRelatieType1.length === 0) {
    await db.insert(relatieTypen).values({
      id: "behoort_bij",
      omschrijving: "Behoort bij",
    });
    console.log("Stamgegeven aangemaakt: Relatietype 'behoort_bij'");
  }

  // 3. Relatietype 'bekend_als'
  const bestaandRelatieType2 = await db.select().from(relatieTypen).where(eq(relatieTypen.id, "bekend_als")).limit(1);
  if (bestaandRelatieType2.length === 0) {
    await db.insert(relatieTypen).values({
      id: "bekend_als",
      omschrijving: "Bekend als",
    });
    console.log("Stamgegeven aangemaakt: Relatietype 'bekend_als'");
  }
}

export async function getCsvMetadata() {
  try {
    const data = readCsvFile();
    console.log(`Metadata opgevraagd. Totaal aantal rijen in CSV: ${data.length}`);
    return { success: true, totalRows: data.length };
  } catch (error: any) {
    console.error("Fout bij ophalen CSV metadata:", error);
    return { success: false, message: error.message, totalRows: 0 };
  }
}

export async function importSpecimensChunk(startIndex: number, chunkSize: number) {
  try {
    const allData = readCsvFile();
    const chunk = allData.slice(startIndex, startIndex + chunkSize);
    const nu = new Date().toISOString();
    
    console.log(`Start verwerken chunk: regel ${startIndex} tot ${startIndex + chunk.length}`);

    // Zorg dat metadata-sleutels (zoals 'aantal') aanwezig zijn
    await ensureMetadataExists();
    
    const doosCache = new Map<string, string>();

    for (const row of chunk) {
      const doosNaam = row.Insectendoosnaam?.trim();
      const csvSoortNaam = row.soortnaam?.trim();
      const aantal = parseInt(row.aantal, 10) || 1;
      const volgnr = parseInt(row.volgnr, 10) || 0;

      if (!doosNaam || !csvSoortNaam) {
        console.warn("Rij overgeslagen wegens ontbrekende doosnaam of soortnaam:", row);
        continue;
      }

      // 1. Controleer of de doos bestaat
      let doosId = doosCache.get(doosNaam);
      if (!doosId) {
        const bestaandeDoos = await db
          .select()
          .from(objecten)
          .where(eq(objecten.weergaveNaam, doosNaam))
          .limit(1);

        if (bestaandeDoos.length > 0) {
          doosId = bestaandeDoos[0].id;
        } else {
          doosId = uuidv4();
          await db.insert(objecten).values({
            id: doosId,
            type: "kast",
            weergaveNaam: doosNaam,
            createdAt: nu,
          });
          console.log(`Nieuwe doos aangemaakt in DB: ${doosNaam} (ID: ${doosId})`);
        }
        doosCache.set(doosNaam, doosId);
      }

      // 2. Zoek naar een taxonomische match ("eerste-twee-woorden-regel")
      const csvTweeWoorden = getFirstTwoWords(csvSoortNaam);
      let gematchedTaxonId: string | null = null;

      if (csvTweeWoorden) {
        const potentieleMatches = await db
          .select()
          .from(objecten)
          .where(like(objecten.weergaveNaam, `${csvTweeWoorden}%`));

        const taxonMatch = potentieleMatches.find((obj) => {
          const dbTweeWoorden = getFirstTwoWords(obj.weergaveNaam);
          return dbTweeWoorden.toLowerCase() === csvTweeWoorden.toLowerCase();
        });

        if (taxonMatch) {
          gematchedTaxonId = taxonMatch.id;
        }
      }

      // 3. Bepaal de naam voor het nieuwe specimen-object
      const specimenWeergaveNaam = gematchedTaxonId 
        ? csvSoortNaam 
        : `${csvSoortNaam} NIET IN NSR`;

      // 4. Voeg het Specimen toe
      const specimenId = uuidv4();
      await db.insert(objecten).values({
        id: specimenId,
        type: "specimen",
        weergaveNaam: specimenWeergaveNaam,
        createdAt: nu,
      });

      // 5. Relatie: Doos -> Specimen ("behoort_bij")
      await db.insert(objectRelaties).values({
        id: uuidv4(),
        vanObjectId: doosId,
        naarObjectId: specimenId,
        relatieTypeId: "behoort_bij",
        volgorde: volgnr,
        createdAt: nu,
      });

      // 6. Meting: Aantal
      await db.insert(metingen).values({
        id: uuidv4(),
        objectId: specimenId,
        parameterId: "aantal",
        waarde: aantal.toString(),
        tijdstipUtc: nu,
      });

      // 7. Relatie: Specimen -> Taxon ("bekend_als")
      if (gematchedTaxonId) {
        await db.insert(objectRelaties).values({
          id: uuidv4(),
          vanObjectId: specimenId,
          naarObjectId: gematchedTaxonId,
          relatieTypeId: "bekend_als",
          createdAt: nu,
        });
      }
    }

    console.log(`Chunk succesvol opgeslagen in DB.`);
    return { success: true };
  } catch (error: any) {
    console.error("FOUT in Server Action tijdens importeren chunk:", error);
    return { success: false, message: error.message };
  }
}