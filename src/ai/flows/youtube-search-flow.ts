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
    // GÜVENLİK KİLİDİ: API anahtarı yoksa, istek gönderme ve boş dön.
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn("YOUTUBE_API_KEY ortam değişkeni ayarlanmamış. Arama aracı atlanıyor.");
      return { videos: [] };
    }
    
    // TEŞHİS ADIMI: Kullanılan API anahtarını konsola yazdır
    console.log("Kullanılan API Anahtarı (ilk 5 karakter):", process.env.YOUTUBE_API_KEY.substring(0, 5));

    // YouTube API'sini başlatma
    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY,
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
    // LLM'in prompt'u işlemesini sağla
    const llmResponse = await prompt(input);
    
    // LLM bir araç kullanmaya karar vermediyse, boş bir sonuç döndür.
    if (!llmResponse.toolRequests || llmResponse.toolRequests.length === 0) {
      console.log("LLM, arama aracı kullanmaya gerek duymadı.");
      return { songs: [] };
    }

    // AI, araç kullanımını istedi, şimdi aracı çalıştıracağız.
    // Bizim durumumuzda sadece bir araç olduğu için, ilkini alıyoruz.
    const toolRequest = llmResponse.toolRequests[0];
    if (!toolRequest) {
      console.error("Tool request tanımsız geldi ama LLM bir araç kullanmak istedi.");
      return { songs: [] };
    }

    // İsteğin doğru araç için olduğunu doğrula (sağlamlık için)
    if (toolRequest.toolName !== 'youtubeSearchTool') {
       console.warn(`Beklenmedik araç isteği: ${toolRequest.toolName}`);
       return { songs: [] };
    }
    
    // Aracı çalıştır ve çıktısını al
    const toolOutput = (await toolRequest.run()) as z.infer<typeof youtubeSearchTool.outputSchema>;
    
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
