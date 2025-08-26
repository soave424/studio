import type { TeamsByLevel } from '@/types';

export function exportTeamsToCSV(teamsByLevel: TeamsByLevel) {
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF모둠 번호,ID,이름,성별,학교,학교급,지역\n";
  let globalTeamCounter = 0;
  const sortedLevels = Object.keys(teamsByLevel).sort((a, b) => ['초등', '중등', '고등', '대학', '기타'].indexOf(a) - ['초등', '중등', '고등', '대학', '기타'].indexOf(b));

  sortedLevels.forEach(level => {
    const teams = teamsByLevel[level];
    teams.forEach((team, index) => {
      const teamId = globalTeamCounter + index + 1;
      team.forEach(member => {
        const row = [teamId, member.id, member.name, member.gender, `"${member.school}"`, member.level, member.region].join(',');
        csvContent += row + "\r\n";
      });
    });
    globalTeamCounter += teams.length;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "조편성_결과.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
