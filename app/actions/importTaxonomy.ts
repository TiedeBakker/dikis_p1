// app/actions/importTaxonomy.ts
export const dynamic = "force-dynamic";
"use server";

import { db } from "@/db"; // Jouw Drizzle/DB verbinding
import {
    objecten,
    objectRelaties,
    metingen,
    objectTypen,
    parameterDefinities,
    relatieTypen
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Interfaces gebaseerd op jouw CSV-bestanden
interface TaxonRow {
    taxonID: string;
    scientificName: string;
    taxonRank: string;
    kingdom: string;
    phylum: string;
    class: string;
    order: string;
    family: string;
    genus: string;
    specificEpithet: string;
    infraspecificEpithet?: string;
}

interface VernacularRow {
    taxonID: string;
    vernacularName: string;
    isPreferredName: string; // "true" of "false"
    language: string; // "Dutch"
}

export async function importNSRTaxonomy(taxa: TaxonRow[], vernaculars: VernacularRow[]) {
    const nuUtc = new Date().toISOString();

    try {
        console.log(`Start import van ${taxa.length} taxa en ${vernaculars.length} namen...`);

        // 1. Zorg dat de basis-metadata aanwezig is in de database
        await zorgVoorBasisMetadata();

        // 2. Map Nederlandse voorkeursnamen voor snelle O(1) lookup
        const nederlandseNamen = new Map<string, string>();
        for (const v of vernaculars) {
            if (v.language === "Dutch" && v.isPreferredName === "true") {
                nederlandseNamen.set(v.taxonID, v.vernacularName);
            }
        }

        // Cache om database-lookups te minimaliseren en snelheid te maximaliseren
        // Key: "NSR_id", Value: "Object_UUID"
        const nsrIdToUuidCache = new Map<string, string>();

        // Helper om een object op te zoeken (via NSR_id in de metingen-tabel) of aan te maken
        async function getOrCreateTaxonObject(
            nsrId: string,
            naam: string,
            typeId: string
        ): Promise<string> {
            // Check eerst de lokale cache van deze importrun
            if (nsrIdToUuidCache.has(nsrId)) {
                return nsrIdToUuidCache.get(nsrId)!;
            }

            // Check de database: is dit nsr_id al eens als meting opgeslagen?
            const bestaandeMeting = await db
                .select()
                .from(metingen)
                .where(
                    and(
                        eq(metingen.parameterId, "nsr_id"),
                        eq(metingen.waarde, nsrId)
                    )
                )
                .limit(1);

            if (bestaandeMeting.length > 0) {
                const existingUuid = bestaandeMeting[0].objectId;
                nsrIdToUuidCache.set(nsrId, existingUuid);

                // Update de weergavenaam als deze is veranderd in het nieuwe register
                await db
                    .update(objecten)
                    .set({ weergaveNaam: naam })
                    .where(eq(objecten.id, existingUuid));

                return existingUuid;
            }
            // Dynamische fallback-check voor onvoorziene rangen:
            await db.insert(objectTypen).values({
                id: typeId,
                omschrijving: `Taxon: ${typeId.replace('taxon_', '')}`
            }).onConflictDoNothing();

            // Nieuw object aanmaken in de 'objecten' tabel
            const newUuid = uuidv4();
            await db.insert(objecten).values({
                id: newUuid,
                type: typeId, // referreert naar objectTypen.id
                weergaveNaam: naam,
                createdAt: nuUtc,
            });

            // Sla de NSR_id op als waarde in de EAV 'metingen' tabel
            await db.insert(metingen).values({
                id: uuidv4(),
                objectId: newUuid,
                parameterId: "nsr_id",
                waarde: nsrId,
                tijdstipUtc: nuUtc,
            });

            nsrIdToUuidCache.set(nsrId, newUuid);
            return newUuid;
        }

        // Helper om de hierarchische relatie (ouder -> kind) aan te leggen in 'object_relaties'
        async function zorgVoorRelatie(vanId: string, naarId: string) {
            const bestaandeRelatie = await db
                .select()
                .from(objectRelaties)
                .where(
                    and(
                        eq(objectRelaties.vanObjectId, vanId),
                        eq(objectRelaties.naarObjectId, naarId),
                        eq(objectRelaties.relatieTypeId, "taxonomische_afstammeling")
                    )
                )
                .limit(1);

            if (bestaandeRelatie.length === 0) {
                await db.insert(objectRelaties).values({
                    id: uuidv4(),
                    vanObjectId: vanId,
                    naarObjectId: naarId,
                    relatieTypeId: "taxonomische_afstammeling",
                    volgorde: 0,
                    createdAt: nuUtc,
                });
            }
        }

        // 3. VERWERK DE BOOM (Van hoog naar laag)
        for (const taxon of taxa) {
            // 1. De primaire naam is ALTIJD de wetenschappelijke naam
            const wetenschappelijkeNaam = taxon.scientificName;

            const kingdomNsrId = `NSR_K_${taxon.kingdom}`;
            const phylumNsrId = `NSR_P_${taxon.phylum}`;
            const classNsrId = `NSR_C_${taxon.class}`;
            const orderNsrId = `NSR_O_${taxon.order}`;
            const familyNsrId = `NSR_F_${taxon.family}`;
            const genusNsrId = `NSR_G_${taxon.genus}`;
            const taxonNsrId = taxon.taxonID;

            // Maak de niveaus aan met hun wetenschappelijke namen
            const kingdomUuid = await getOrCreateTaxonObject(kingdomNsrId, taxon.kingdom, "taxon_kingdom");
            let lastParentUuid = kingdomUuid;

            if (taxon.phylum) {
                const phylumUuid = await getOrCreateTaxonObject(phylumNsrId, taxon.phylum, "taxon_phylum");
                await zorgVoorRelatie(lastParentUuid, phylumUuid);
                lastParentUuid = phylumUuid;
            }

            if (taxon.class) {
                const classUuid = await getOrCreateTaxonObject(classNsrId, taxon.class, "taxon_class");
                await zorgVoorRelatie(lastParentUuid, classUuid);
                lastParentUuid = classUuid;
            }

            if (taxon.order) {
                const orderUuid = await getOrCreateTaxonObject(orderNsrId, taxon.order, "taxon_order");
                await zorgVoorRelatie(lastParentUuid, orderUuid);
                lastParentUuid = orderUuid;
            }

            if (taxon.family) {
                const familyUuid = await getOrCreateTaxonObject(familyNsrId, taxon.family, "taxon_family");
                await zorgVoorRelatie(lastParentUuid, familyUuid);
                lastParentUuid = familyUuid;
            }

            if (taxon.genus) {
                const genusUuid = await getOrCreateTaxonObject(genusNsrId, taxon.genus, "taxon_genus");
                await zorgVoorRelatie(lastParentUuid, genusUuid);
                lastParentUuid = genusUuid;
            }

            // Maak de specifieke soort aan (altijd met de wetenschappelijke naam)
            const typeRankId = `taxon_${taxon.taxonRank.toLowerCase()}`;
            const taxonUuid = await getOrCreateTaxonObject(taxonNsrId, wetenschappelijkeNaam, typeRankId);

            await zorgVoorRelatie(lastParentUuid, taxonUuid);

            // 2. VOEG DE NEDERLANDSE NAAM TOE ALS EXTRA PARAMETER (indien beschikbaar)
            const nederlandseNaam = nederlandseNamen.get(taxon.taxonID);
            if (nederlandseNaam) {
                // Check of deze Nederlandse naam al geregistreerd staat voor dit object
                const bestaandeNlNaam = await db
                    .select()
                    .from(metingen)
                    .where(
                        and(
                            eq(metingen.objectId, taxonUuid),
                            eq(metingen.parameterId, "naam_nl")
                        )
                    )
                    .limit(1);

                if (bestaandeNlNaam.length === 0) {
                    await db.insert(metingen).values({
                        id: uuidv4(),
                        objectId: taxonUuid,
                        parameterId: "naam_nl",
                        waarde: nederlandseNaam,
                        tijdstipUtc: nuUtc,
                    });
                } else if (bestaandeNlNaam[0].waarde !== nederlandseNaam) {
                    // Update als de naam gewijzigd is
                    await db
                        .update(metingen)
                        .set({ waarde: nederlandseNaam, tijdstipUtc: nuUtc })
                        .where(eq(metingen.id, bestaandeNlNaam[0].id));
                }
            }
        }
        return { success: true, message: "Taxonomie en hiërarchie succesvol bijgewerkt!" };
    } catch (error: any) {
        console.error("Fout tijdens importeren:", error);
        return { success: false, message: error.message };
    }
}

// Hulpmethode om ervoor te zorgen dat de benodigde typen en parameters in de DB staan
async function zorgVoorBasisMetadata() {
    const typen = [
        { id: "taxon_kingdom", omschrijving: "Taxon: Rijk (Kingdom)" },
        { id: "taxon_phylum", omschrijving: "Taxon: Stam (Phylum)" },
        { id: "taxon_class", omschrijving: "Taxon: Klasse (Class)" },
        { id: "taxon_order", omschrijving: "Taxon: Orde (Order)" },
        { id: "taxon_family", omschrijving: "Taxon: Familie (Family)" },
        { id: "taxon_genus", omschrijving: "Taxon: Geslacht (Genus)" },
        { id: "taxon_species", omschrijving: "Taxon: Soort (Species)" },
        { id: "taxon_subspecies", omschrijving: "Taxon: Ondersoort (Subspecies)" },
        { id: "taxon_varietas", omschrijving: "Taxon: Variëteit (Varietas)" },
        { id: "taxon_forma", omschrijving: "Taxon: Vorm (Forma)" },
        { id: "taxon_nothospecies", omschrijving: "Taxon: Hybride soort (Nothospecies)" },
        { id: "taxon_nothosubspecies", omschrijving: "Taxon: Hybride ondersoort (Nothosubspecies)" },
    ];

    for (const t of typen) {
        await db.insert(objectTypen).values(t).onConflictDoNothing();
    }

    // Registreer de nsr_id parameterdefinitie in de stamlijst
    await db.insert(parameterDefinities).values({
        id: "nsr_id",
        naam: "NSR_id",
        dataType: "tekst",
        helpTekst: "Het unieke identificatienummer uit het Nederlands Soortenregister",
    }).onConflictDoNothing();
    // Voeg deze toe in de zorgVoorBasisMetadata() functie, net onder 'nsr_id'
    await db.insert(parameterDefinities).values({
        id: "naam_nl",
        naam: "Nederlandse naam",
        dataType: "tekst",
        helpTekst: "De voorkeursnaam in het Nederlands",
    }).onConflictDoNothing();

    // Registreer het relatietype in 'relatieTypen'
    await db.insert(relatieTypen).values({
        id: "taxonomische_afstammeling",
        omschrijving: "is bovenliggend taxon van",
        omgekeerdeOmschrijving: "behoort tot taxon",
        toelichting: "Gebruikt voor de hierarchische boomstructuur van biologische taxonomie.",
    }).onConflictDoNothing();
}