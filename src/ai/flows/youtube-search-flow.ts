'use server';

/**
 * @fileOverview A flow for searching YouTube for songs.
 *
 * - searchYoutube - A function that searches YouTube for songs.
 * - YouTubeSearchInput - The input type for the searchYoutube function.
 * - YouTubeSearchOutput - The return type for the searchYoutube function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';

// YouTube API'sini başlatma
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

// Kendi YouTube arama aracımızı tanımlıyoruz
const youtubeSearchTool = ai.defineTool(
  {
    name: 'youtubeSearchTool',
    description: 'Searches YouTube for music videos based on a query.',
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
  }
);

const YouTubeSearchInputSchema = z.object({
  query: z.string().describe('The search query for YouTube.'),
});
export type YouTubeSearchInput = z.infer<typeof YouTubeSearchInputSchema>;

const SongSuggestionSchema = z.object({
  videoId: z
    .string()
    .describe(
      'The YouTube video ID. This should be a valid YouTube video ID.'
    ),
  title: z.string().describe('The title of the song.'),
  thumbnailUrl: z.string().url().describe('The URL of the video thumbnail.'),
});

const YouTubeSearchOutputSchema = z.object({
  songs: z
    .array(SongSuggestionSchema)
    .describe('A list of song suggestions from YouTube.'),
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
  prompt: `You are an expert YouTube music search engine. 
  Use the youtubeSearchTool to find songs relevant to the user's query.

  Search Query: {{{query}}}
  
  After getting the results from the tool, format them into the required "songs" array output.`,
});

const youtubeSearchFlow = ai.defineFlow(
  {
    name: 'youtubeSearchFlow',
    inputSchema: YouTubeSearchInputSchema,
    outputSchema: YouTubeSearchOutputSchema,
  },
  async input => {
    const response = await prompt(input);
    const toolResponse = response.toolRequests[0];
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
