import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// Zorg dat dit exact matcht met je .env.local / drizzle.config.ts
const connectionUrl = process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!connectionUrl) {
  throw new Error("TURSO_CONNECTION_URL is niet gedefinieerd in de omgevingsvariabelen.");
}

const client = createClient({
  url: connectionUrl,
  authToken: authToken, // Mag leeg zijn bij lokale dev (bijv. met een lokale libsql file)
});

export const db = drizzle(client, { schema });