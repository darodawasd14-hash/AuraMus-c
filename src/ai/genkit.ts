import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// API anahtarını .env dosyasından güvenli bir şekilde alıyoruz.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY ortam değişkeni ayarlanmamış. Genkit düzgün çalışmayabilir. Lütfen .env dosyanızı kontrol edin ve geliştirme sunucusunu yeniden başlatın.");
}

// Bu dosya artık 'use server' içermiyor.
// Sadece 'ai' nesnesini yapılandırıp dışa aktarır.
export const ai = genkit({
  plugins: [googleAI({ apiKey: GEMINI_API_KEY })],
});
