// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

const env = dotenv.config({ path: '.env.local' }).parsed;

export default defineConfig({
  schema: './db/schema.ts', 
  out: './drizzle',             
  dialect: 'turso',             
  dbCredentials: {              
    // GEWIJZIGD: Nu ook hier TURSO_CONNECTION_URL gebruiken
    url: process.env.TURSO_CONNECTION_URL || env?.TURSO_CONNECTION_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || env?.TURSO_AUTH_TOKEN || '',
  },
});