'use server';
/**
 * @fileOverview Flow to set admin custom claims on a user.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App } from 'firebase-admin/app';

// Ensure Firebase Admin is initialized only once
function getFirebaseAdminApp(): App {
  if (getApps().length) {
    return getApps()[0]!;
  }
  // When running in a serverless environment (like Genkit flows),
  // Firebase Admin SDK can be initialized without explicit credentials.
  // It automatically discovers service account credentials.
  return initializeApp();
}

const SetAdminClaimInputSchema = z.object({
  email: z.string().email().describe('The email address of the user to make an admin.'),
});
export type SetAdminClaimInput = z.infer<typeof SetAdminClaimInputSchema>;

const SetAdminClaimOutputSchema = z.object({
  message: z.string(),
});
export type SetAdminClaimOutput = z.infer<typeof SetAdminClaimOutputSchema>;


export async function setAdminClaim(input: SetAdminClaimInput): Promise<SetAdminClaimOutput> {
    return setAdminClaimFlow(input);
}


const setAdminClaimFlow = ai.defineFlow(
  {
    name: 'setAdminClaimFlow',
    inputSchema: SetAdminClaimInputSchema,
    outputSchema: SetAdminClaimOutputSchema,
  },
  async (input) => {
    try {
      // Initialize Firebase Admin SDK right before it's needed.
      getFirebaseAdminApp(); 
      
      const auth = getAuth();
      const user = await auth.getUserByEmail(input.email);
      await auth.setCustomUserClaims(user.uid, { isAdmin: true });
      return {
        message: `Successfully set admin claim for ${input.email}`,
      };
    } catch (error: any) {
      console.error('Failed to set admin claim:', error);
      throw new Error(`Failed to set admin claim for ${input.email}: ${error.message}`);
    }
  }
);
