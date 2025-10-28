'use server';

/**
 * @fileOverview A flow for generating smart playlist suggestions based on user listening history.
 *
 * - suggestSmartPlaylist - A function that generates a smart playlist based on user listening history.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartPlaylistInputSchema = z.object({
  listeningHistory: z
    .string()
    .describe(
      'A comma-separated list of songs, artists, and albums representing the user\'s listening history.'
    ),
  playlistLength: z
    .number()
    .default(10)
    .describe('The desired number of songs in the generated playlist.'),
});
export type SmartPlaylistInput = z.infer<typeof SmartPlaylistInputSchema>;

const SmartPlaylistOutputSchema = z.object({
  playlistName: z.string().describe('The name of the generated playlist.'),
  songList: z.array(z.string()).describe('A list of song suggestions for the playlist.'),
});
export type SmartPlaylistOutput = z.infer<typeof SmartPlaylistOutputSchema>;

const prompt = ai.definePrompt({
  name: 'smartPlaylistPrompt',
  input: {schema: SmartPlaylistInputSchema},
  output: {schema: SmartPlaylistOutputSchema},
  prompt: `You are a playlist generation expert. You take a user's listening history and generate a playlist of similar songs.

    Listening History: {{{listeningHistory}}}
    Playlist Length: {{{playlistLength}}}

    Consider the user's listening history and create a playlist of songs they would enjoy.  Give the playlist a relevant name.
    Return a JSON object with the playlistName and songList. The songList should contain {{{playlistLength}}} songs.`,
});

const smartPlaylistFlow = ai.defineFlow(
  {
    name: 'smartPlaylistFlow',
    inputSchema: SmartPlaylistInputSchema,
    outputSchema: SmartPlaylistOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);


export async function suggestSmartPlaylist(
  input: SmartPlaylistInput
): Promise<SmartPlaylistOutput> {
  return smartPlaylistFlow(input);
}
