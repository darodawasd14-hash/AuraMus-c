import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Güvenlik Notu: Bu anahtar, yalnızca sunucu tarafında çalıştığı için ('use server') istemciye sızdırılmaz.
const GEMINI_API_KEY = "AIzaSyB-R_aXJqsA52P8W0F9lzhYpM7o0N33yWc";

export const ai = genkit({
  plugins: [googleAI({ apiKey: GEMINI_API_KEY })],
  model: 'googleai/gemini-2.5-flash',
});
