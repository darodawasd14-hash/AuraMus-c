'use server';

/**
 * @fileOverview Kullanıcının geçerli şarkı hakkındaki sorularını yanıtlayan bir AI akışı.
 *
 * - answerSongQuestion - Bir şarkı hakkındaki soruyu yanıtlayan fonksiyon.
 * - SongQuestionInput - answerSongQuestion fonksiyonunun giriş tipi.
 * - SongQuestionOutput - answerSongQuestion fonksiyonunun dönüş tipi.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SongQuestionInputSchema = z.object({
  songTitle: z.string().describe('Kullanıcının hakkında soru sorduğu şarkının adı.'),
  question: z.string().describe('Kullanıcının şarkı hakkındaki sorusu.'),
});
type SongQuestionInput = z.infer<typeof SongQuestionInputSchema>;

const SongQuestionOutputSchema = z.object({
  answer: z.string().describe('Kullanıcının sorusuna verilen cevap.'),
});
type SongQuestionOutput = z.infer<typeof SongQuestionOutputSchema>;

export async function answerSongQuestion(
  input: SongQuestionInput
): Promise<SongQuestionOutput> {
  return songQuestionFlow(input);
}

const songQuestionFlow = ai.defineFlow(
  {
    name: 'songQuestionFlow',
    inputSchema: SongQuestionInputSchema,
    outputSchema: SongQuestionOutputSchema,
  },
  async (input) => {
    // Gemini'nin en yetenekli modelini, araçları (internet araması gibi) kullanması için etkinleştirerek çağırıyoruz.
    const llmResponse = await ai.generate({
      prompt: `Sen Aura, bir müzik uzmanı ve sohbet asistanısın. Kullanıcı, "${input.songTitle}" adlı şarkıyı dinliyor ve bu şarkıyla ilgili bir soru sordu.

Kullanıcının sorusu: "${input.question}"

Lütfen bu soruya internetten veya kendi bilginden yararlanarak bilgilendirici ve samimi bir cevap ver. Cevabın Markdown formatında olabilir.`,
      model: 'googleai/gemini-2.5-flash',
      tools: [], // Gelecekte özel araçlar eklenebilir.
      config: {
        // Gerekirse sıcaklık vb. ayarlarını burada yapın.
      },
    });

    return {
      answer: llmResponse.text,
    };
  }
);
