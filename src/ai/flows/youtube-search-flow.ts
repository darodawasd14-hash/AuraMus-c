'use server';

/**
 * @fileOverview A flow for searching YouTube for songs.
 *
 * - searchYoutube - A function that searches YouTube for songs.
 * - YouTubeSearchInput - The input type for the searchYoutube function.
 * - YouTubeSearchOutput - The return type for the searchYoutube function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  artist: z.string().describe('The artist of the song.'),
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
  prompt: `You are an expert YouTube music search engine. You take a user's query and find relevant songs on YouTube.

    Search Query: {{{query}}}

    Find 12 relevant songs on YouTube based on the query. Ensure the videoId is a valid YouTube video ID. For the thumbnailUrl, use the format 'https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg'.
    Return a JSON object with a "songs" array.`,
});

const youtubeSearchFlow = ai.defineFlow(
  {
    name: 'youtubeSearchFlow',
    inputSchema: YouTubeSearchInputSchema,
    outputSchema: YouTubeSearchOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
