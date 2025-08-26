// src/ai/flows/suggest-team-activity.ts
'use server';

/**
 * @fileOverview Provides AI suggestions for team activities, including a team name and icebreaker questions.
 *
 * - suggestTeamActivity - A function that generates team name and icebreaker questions based on team member profiles.
 * - SuggestTeamActivityInput - The input type for the suggestTeamActivity function.
 * - SuggestTeamActivityOutput - The return type for the suggestTeamActivity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTeamActivityInputSchema = z.object({
  teamMembers: z.array(
    z.object({
      name: z.string().describe('Team member name'),
      school: z.string().describe('Team member school'),
      level: z.string().describe('Team member level (e.g., 초등, 중등, 고등)'),
    })
  ).describe('Array of team members with their names, schools, and levels.'),
});
export type SuggestTeamActivityInput = z.infer<typeof SuggestTeamActivityInputSchema>;

const SuggestTeamActivityOutputSchema = z.object({
  teamName: z.string().describe('A creative and cool team name for the group.'),
  icebreakers: z.array(z.string()).describe('A list of fun and engaging icebreaker questions suitable for the team.'),
});
export type SuggestTeamActivityOutput = z.infer<typeof SuggestTeamActivityOutputSchema>;

export async function suggestTeamActivity(input: SuggestTeamActivityInput): Promise<SuggestTeamActivityOutput> {
  return suggestTeamActivityFlow(input);
}

const suggestTeamActivityPrompt = ai.definePrompt({
  name: 'suggestTeamActivityPrompt',
  input: {schema: SuggestTeamActivityInputSchema},
  output: {schema: SuggestTeamActivityOutputSchema},
  prompt: `You are a fun and creative assistant for a youth camp in Korea. A new team has just been formed.

  {% if teamMembers.length > 0 %}
  The team members are:
  {{#each teamMembers}}
  - {{name}} ({{school}}, {{level}})
  {{/each}}
  {% else %}
  There are no team members.
  {% endif %}

  Please provide the following in Korean:
  1. A creative and cool team name for this group.
  2. Three fun and engaging icebreaker questions suitable for these students to get to know each other.
  Please respond in JSON format.
  {
    "teamName": "추천 팀 이름",
    "icebreakers": ["아이스브레이커 질문 1", "아이스브레이커 질문 2", "아이스브레이커 질문 3"]
  }
  `,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const suggestTeamActivityFlow = ai.defineFlow(
  {
    name: 'suggestTeamActivityFlow',
    inputSchema: SuggestTeamActivityInputSchema,
    outputSchema: SuggestTeamActivityOutputSchema,
  },
  async input => {
    const {output} = await suggestTeamActivityPrompt(input);
    return output!;
  }
);
