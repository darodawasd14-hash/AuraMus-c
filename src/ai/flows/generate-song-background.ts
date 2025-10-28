'use server';
/**
 * @fileOverview A flow for generating an artistic background image based on a song.
 *
 * - generateSongBackground - A function that generates an image based on song details.
 * - GenerateSongBackgroundInput - The input type for the function.
 * - GenerateSongBackgroundOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateSongBackgroundInputSchema = z.object({
  songTitle: z.string().describe('The title of the song.'),
  songType: z.string().describe('The genre or type of the song.'),
});
export type GenerateSongBackgroundInput = z.infer<typeof GenerateSongBackgroundInputSchema>;

const GenerateSongBackgroundOutputSchema = z.object({
  imageUrl: z.string().url().describe('The data URI of the generated background image.'),
});
export type GenerateSongBackgroundOutput = z.infer<typeof GenerateSongBackgroundOutputSchema>;

export async function generateSongBackground(
  input: GenerateSongBackgroundInput
): Promise<GenerateSongBackgroundOutput> {
  return generateBackgroundFlow(input);
}

const prompt = ai.definePrompt(
  {
    name: 'generateSongBackgroundPrompt',
    input: { schema: GenerateSongBackgroundInputSchema },
    prompt: `Create a visually stunning and artistic background image that represents the mood and theme of the song: "{{songTitle}}".

    The style should be abstract, atmospheric, and evoke emotions related to a "{{songType}}" song. Use a rich color palette. This is for a music application background. Digital art, high resolution.`,
  },
);

const generateBackgroundFlow = ai.defineFlow(
  {
    name: 'generateBackgroundFlow',
    inputSchema: GenerateSongBackgroundInputSchema,
    outputSchema: GenerateSongBackgroundOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: await prompt.render({ input }),
    });

    if (!media.url) {
      throw new Error('Image generation failed.');
    }

    return { imageUrl: media.url };
  }
);
