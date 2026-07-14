// db/schema.ts

import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

// =========================================================================
// 1. STAMLIJSTEN & METADATA DEFINITIES (De bouwstenen van het universum)
// =========================================================================

// Systeem-brede objecttypen (bijv: 'insect', 'kast', 'persoon', 'gebouw')
export const objectTypen = sqliteTable("object_typen", {
  id: text("id").primaryKey(), // snake_case
  omschrijving: text("omschrijving").notNull(),
  toelichting: text("toelichting"), // NIEUW: Optionele uitgebreide documentatie
});
// Gestandaardiseerde eenheden (bijv: 'celsius', 'millimeter', 'euro')
export const eenheden = sqliteTable("eenheden", {
  id: text("id").primaryKey(),
  symbool: text("symbool").notNull(), // '°C', 'mm', '€'
  omschrijving: text("omschrijving").notNull(), // 'Graden Celsius'
});


// Alle mogelijke parameters/kenmerken in het systeem (voor metingen, eigenschappen, etc.)
export const parameterDefinities = sqliteTable("parameter_definities", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  // "textarea" is hier toegevoegd aan de enum-smaken:
  dataType: text("data_type", { enum: ["tekst", "textarea", "numeriek", "keuzelijst", "datum"] }).notNull(),
  eenheidId: text("eenheid_id").references(() => eenheden.id),
  helpTekst: text("help_tekst"),
  keuzeOpties: text("keuze_opties"), // JSON-array voor keuzelijst
});


// Relatietypen tussen objecten (bijv: 'fysiek_onderdeel_van', 'huwelijk_met', 'beheerd_door')
export const relatieTypen = sqliteTable("relatie_typen", {
  id: text("id").primaryKey(), // snake_case
  omschrijving: text("omschrijving").notNull(),
  omgekeerdeOmschrijving: text("omgekeerde_omschrijving"),
  toelichting: text("toelichting"), // NIEUW: Optionele uitgebreide documentatie
});

// =========================================================================
// 2. PARAMETER SETS & FORMULIER CONFIGURATIE (De flexibele formulier-sturing)
// =========================================================================

// De definitie van een groep parameters (bijv: 'klimaat_set', 'insecten_basis_set')
export const parameterSets = sqliteTable("parameter_sets", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  omschrijving: text("omschrijving"),
});

// Welke parameters zitten er in welke set, en in welke volgorde?
export const parameterSetLijnen = sqliteTable("parameter_set_lijnen", {
  parameterSetId: text("parameter_set_id").notNull().references(() => parameterSets.id),
  parameterId: text("parameter_id").notNull().references(() => parameterDefinities.id),
  volgorde: integer("volgorde").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.parameterSetId, table.parameterId] }),
}));

// DE DYNAMISCHE FORMULIER ENGINE: Koppelt een set of losse parameter aan een context
export const formulierConfiguratie = sqliteTable("formulier_configuratie", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  objectTypeId: text("object_type_id").references(() => objectTypen.id), // Gekoppeld aan heel type...
  specificObjectId: text("specific_object_id"), // ...óf specifiek aan één object (override)
  parameterSetId: text("parameter_set_id").references(() => parameterSets.id), // Kan een set zijn...
  parameterId: text("parameter_id").references(() => parameterDefinities.id), // ...of een losse parameter
  volgorde: integer("volgorde").notNull().default(0),
});

// =========================================================================
// 3. DE DATA & HET NETWERK (De Drie-eenheid met jouw scherpe upgrades)
// =========================================================================

// De Entiteiten (Alles is een object: een kast, een specimen, maar ook een inspecteur/persoon!)
export const objecten = sqliteTable("objecten", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  type: text("type").notNull().references(() => objectTypen.id),
  weergaveNaam: text("weergave_naam").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Het Netwerk / De Edges (Met eigen ID, tijdlijnen en metadata-type)

export const objectRelaties = sqliteTable("object_relaties", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  vanObjectId: text("van_object_id").notNull().references(() => objecten.id),
  naarObjectId: text("naar_object_id").notNull().references(() => objecten.id),
  relatieTypeId: text("relatie_type_id").notNull().references(() => relatieTypen.id),
  volgorde: integer("volgorde").notNull().default(0),
  toelichting: text("toelichting"), // <-- VOEG DEZE TOE VOOR AD-HOC OPMERKINGEN
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  validUntil: text("valid_until"),
});

// EAV / De Waarden
export const metingen = sqliteTable("metingen", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  objectId: text("object_id").notNull().references(() => objecten.id), // Kan ook een relatie-id zijn indien gewenst via flexibele query, of we maken een aparte tabel voor relatie-metingen. Laten we het hier puur op objecten houden.
  parameterId: text("parameter_id").notNull().references(() => parameterDefinities.id),
  waarde: text("waarde").notNull(),
  tijdstipUtc: text("tijdstip_utc").notNull(),
  ingevoerdDoorObjectId: text("ingevoerd_by_object_id").references(() => objecten.id), // NU HARD LINK NAAR EEN OBJECT (Inspecteur)
});