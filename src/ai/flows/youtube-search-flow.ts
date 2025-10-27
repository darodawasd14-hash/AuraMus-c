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

// API ANAHTARINI GÜVENLİ BİR ŞEKİLDE DOĞRUDAN KODA EKLİYORUZ.
// Bu dosya 'use server' olarak işaretlendiği için anahtar istemciye sızdırılmaz.
const YOUTUBE_API_KEY = "AIzaSyAXua69v9V1KgttqLR27d7HjPTs6O7-HyA";

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
    // GÜVENLİK KİLİDİ: API anahtarı boşsa veya geçersizse, istek gönderme ve hata fırlat.
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'AIzaSyAXua69v9V1KgttqLR27d7HjPTs6O7-HyA_REPLACE_ME') {
      console.warn("YOUTUBE_API_KEY sabiti ayarlanmamış veya varsayılan değerde. Arama aracı atlanıyor.");
      throw new Error("YouTube API anahtarı yapılandırılmamış. Lütfen geçerli bir anahtar sağlayın.");
    }
    
    // YouTube API'sini başlatma
    const youtube = google.youtube({
      version: 'v3',
      auth: YOUTUBE_API_KEY,
    });
    
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
        })).filter(video => video.videoId) || []; // videoId'si olmayanları filtrele

      return { videos };
    } catch (error: any) {
      console.error("YouTube API Hatası:", error.message);
      // API'den bir hata geldiğinde (örneğin kota aşımı), bunu kullanıcıya net bir şekilde bildir.
      if (error.message.includes('quota')) {
          throw new Error('YouTube arama kotası aşıldı. Lütfen daha sonra tekrar deneyin.');
      }
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

const youtubeSearchFlow = ai.defineFlow(
  {
    name: 'youtubeSearchFlow',
    inputSchema: YouTubeSearchInputSchema,
    outputSchema: YouTubeSearchOutputSchema,
  },
  async input => {
    // LLM'i atlayıp doğrudan arama aracını çağırıyoruz.
    try {
      const toolOutput = await youtubeSearchTool(input);

      // Aracın çıktısını Flow'un beklediği çıktı formatına dönüştür.
      return {
        songs: toolOutput.videos.map(video => ({
          videoId: video.videoId,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
        })),
      };
    } catch (error: any) {
       // Araç bir hata fırlatırsa (API hatası gibi), bunu yakala ve yeniden fırlat.
       // Bu, hatanın UI'a düzgün bir şekilde iletilmesini sağlar.
       console.error("youtubeSearchFlow içinde hata yakalandı:", error);
       throw error;
    }
  }
);
