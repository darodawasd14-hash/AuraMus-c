'use server';

/**
 * @fileOverview YouTube'da şarkı aramak için bir akış.
 *
 * - searchYoutube - YouTube'da şarkı arayan bir fonksiyon.
 * - YouTubeSearchInput - searchYoutube fonksiyonunun giriş tipi.
 * - YouTubeSearchOutput - searchYoutube fonksiyonunun dönüş tipi.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';

if (!process.env.YOUTUBE_API_KEY) {
  throw new Error("YOUTUBE_API_KEY ortam değişkeni ayarlanmamış. Lütfen .env dosyanızı kontrol edin.");
}

// YouTube API'sini başlatma
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

// Kendi YouTube arama aracımızı tanımlıyoruz
const youtubeSearchTool = ai.defineTool(
  {
    name: 'youtubeSearchTool',
    description: "Bir sorguya göre YouTube'da müzik videoları arar.",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({
      videos: z.array(
        z.object({
          videoId: z.string(),
          title: z.string(),
          thumbnailUrl: z.string().url(),
        })
      ),
    }),
  },
  async ({ query }) => {
    try {
      const response = await youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        videoCategoryId: '10', // 10, "Music" kategorisidir
        maxResults: 16,
      });

      const videos =
        response.data.items?.map(item => ({
          videoId: item.id?.videoId || '',
          title: item.snippet?.title || 'Başlık Yok',
          thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ||
            `https://i.ytimg.com/vi/${item.id?.videoId}/hqdefault.jpg`,
        })) || [];

      return { videos };
    } catch (error: any) {
      console.error("YouTube API Hatası:", error.message);
      // API'den bir hata geldiğinde, aracın bunu bir istisna olarak fırlatması gerekir.
      // Bu, akışın hatayı yakalamasına ve uygun şekilde işlemesine olanak tanır.
      throw new Error(`YouTube API hatası: ${error.message}. Lütfen API anahtarınızı veya YouTube Data API kotanızı kontrol edin.`);
    }
  }
);

const YouTubeSearchInputSchema = z.object({
  query: z.string().describe('YouTube için arama sorgusu.'),
});
export type YouTubeSearchInput = z.infer<typeof YouTubeSearchInputSchema>;

const SongSuggestionSchema = z.object({
  videoId: z
    .string()
    .describe(
      "YouTube video ID'si. Bu geçerli bir YouTube video ID'si olmalıdır."
    ),
  title: z.string().describe('Şarkının başlığı.'),
  thumbnailUrl: z.string().url().describe('Video küçük resminin URL\'si.'),
});

const YouTubeSearchOutputSchema = z.object({
  songs: z
    .array(SongSuggestionSchema)
    .describe('YouTube\'dan gelen şarkı önerilerinin bir listesi.'),
});
export type YouTubeSearchOutput = z.infer<typeof YouTubeSearchOutputSchema>;

export async function searchYoutube(
  input: YouTubeSearchInput
): Promise<YouTubeSearchOutput> {
  return youtubeSearchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'youtubeSearchPrompt',
  input: { schema: YouTubeSearchInputSchema },
  output: { schema: YouTubeSearchOutputSchema },
  tools: [youtubeSearchTool], // Oluşturduğumuz gerçek aracı kullanıyoruz
  prompt: `Sen uzman bir YouTube müzik arama motorusun. 
  Kullanıcının sorgusuyla ilgili şarkıları bulmak için youtubeSearchTool'u kullan.

  Arama Sorgusu: {{{query}}}
  
  Araçtan sonuçları aldıktan sonra, bunları gerekli "songs" dizi çıktısına formatla.`,
});

const youtubeSearchFlow = ai.defineFlow(
  {
    name: 'youtubeSearchFlow',
    inputSchema: YouTubeSearchInputSchema,
    outputSchema: YouTubeSearchOutputSchema,
  },
  async input => {
    const response = await prompt(input);

    // Eğer LLM bir araç kullanmaya karar vermediyse, boş bir sonuç döndür.
    if (!response.toolRequests || response.toolRequests.length === 0) {
      console.log("LLM, arama aracı kullanmaya gerek duymadı.");
      return { songs: [] };
    }

    const toolResponse = response.toolRequests[0];
    if (!toolResponse) {
       console.error("Tool response tanımsız geldi.");
       return { songs: [] };
    }
    
    const toolOutput = (await toolResponse.run()) as z.infer<typeof youtubeSearchTool.outputSchema>;
    
    // Aracın çıktısını doğru formata dönüştür
    return {
      songs: toolOutput.videos.map(video => ({
        videoId: video.videoId,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
      })),
    };
  }
);
