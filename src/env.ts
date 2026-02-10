/**
 * Load .env BEFORE any other module initializes.
 * This must be the first import in index.ts.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname: string = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });
