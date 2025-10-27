'use server';
/**
 * @fileOverview This file is not in use and is pending deletion. 
 * It was part of a previous attempt to set admin claims, which is now handled via gcloud CLI.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const StubSchema = z.object({ message: z.string() });

export async function setAdminClaim(input: any): Promise<any> {
    console.error("setAdminClaim is deprecated and should not be called.");
    return { message: "This function is deprecated." };
}

ai.defineFlow(
  {
    name: 'setAdminClaimFlow',
    inputSchema: StubSchema,
    outputSchema: StubSchema,
  },
  async (input) => {
    return { message: "This flow is deprecated." };
  }
);
