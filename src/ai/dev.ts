import { config } from 'dotenv';
config();

import '@/ai/flows/smart-playlist-suggestions.ts';
import '@/ai/flows/youtube-search-flow.ts';
// The set-admin-claim flow is loaded on demand by Genkit and does not need to be explicitly imported here.
// Importing it can sometimes cause issues with the Next.js dev server startup.
// import '@/ai/flows/set-admin-claim.ts';
