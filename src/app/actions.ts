'use server';

import { suggestTeamActivity, SuggestTeamActivityInput } from '@/ai/flows/suggest-team-activity';

export async function getAiSuggestions(
  teamMembers: SuggestTeamActivityInput['teamMembers']
) {
  try {
    const result = await suggestTeamActivity({ teamMembers });
    return result;
  } catch (error) {
    console.error('Error getting AI suggestions:', error);
    return {
      teamName: '오류',
      icebreakers: ['AI 추천을 가져오는 데 실패했습니다.'],
    };
  }
}
