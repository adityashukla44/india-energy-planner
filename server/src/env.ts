import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imported first so every module sees the variables. .env lives at the project root
// (one level above server/); real environment variables (e.g. on a host) take priority.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: [resolve(here, '../../.env'), resolve(here, '../.env')], quiet: true } as dotenv.DotenvConfigOptions);
