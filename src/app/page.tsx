'use client';

import { useState, useMemo, useCallback, type FC, type ChangeEvent, type DragEvent } from 'react';
import type { Student, TeamsByLevel, DraggedItem } from '@/types';
import { parseStudentInfo } from '@/lib/parser';
import { exportTeamsToCSV } from '@/lib/csv';
import { getAiSuggestions } from './actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, PlusCircle, Trash2, Users, Wand2, FileDown, GripVertical, Loader2, Info, Building, MapPin, UserSquare, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const presetData = `1. 홍길동, 남, 경기과학고등학교, 경기 수원
2. 이순신, 남, 남양주초등학교, 서울
3. 조은하, 여, 양지중학교, 강원
4. 유관순, 여, 양지중학교, 경기
5. 신나는학교, 김민준, 남, 고`;

type AppState = 'input' | 'review' | 'results';

export default function TeamWeaverPage() {
  const [appState, setAppState] = useState<AppState>('input');
  const [rawText, setRawText] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [students, setStudents] = useState<Student[]>([]);
  const [teamsByLevel, setTeamsByLevel] = useState<TeamsByLevel>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);

  const [isAiModalOpen, setAiModalOpen] = useState(false);
  const [isSeatingChartModalOpen, setSeatingChartModalOpen] = useState(false);
  const [selectedTeamForAI, setSelectedTeamForAI] = useState<Student[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<{ teamName: string; icebreakers: string[] } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAnalyze = () => {
    setError(null);
    if (!rawText.trim()) {
      setError('참가자 정보를 입력해주세요.');
      return;
    }
    try {
      const lines = rawText.trim().split('\n');
      const parsedStudents = lines
        .filter(line => line.trim() !== '' && !line.startsWith('모둠 번호'))
        .map((line, index) => parseStudentInfo(line, index));

      if (parsedStudents.length === 0) {
        setError('유효한 참가자 정보가 없습니다.');
        return;
      }
      
      setStudents(parsedStudents);
      setAppState('review');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '데이터 분석 중 오류가 발생했습니다.');
    }
  };

  const handleStudentChange = (index: number, prop: keyof Student, value: string) => {
    setStudents(prev => {
      const newStudents = [...prev];
      newStudents[index] = { ...newStudents[index], [prop]: value };
      return newStudents;
    });
  };

  const addStudentRow = () => {
    const newStudent: Student = { id: (students.length + 1).toString(), name: '', gender: '', school: '', level: '', region: '', teamId: '' };
    setStudents(prev => [...prev, newStudent]);
  };

  const deleteStudentRow = (index: number) => {
    setStudents(prev => prev.filter((_, i) => i !== index));
  };
  
  const createBalancedTeams = (students: Student[], targetTeamSize: number): Student[][] => {
    const totalStudents = students.length;
    if (totalStudents === 0) return [];

    const sortedStudents = [...students].sort((a, b) => {
        const regionCompare = a.region.localeCompare(b.region);
        if (regionCompare !== 0) return regionCompare;
        const schoolCompare = a.school.localeCompare(b.school);
        if (schoolCompare !== 0) return schoolCompare;
        return a.gender.localeCompare(b.gender);
    });

    const teams: Student[][] = [];
    let currentTeam: Student[] = [];

    sortedStudents.forEach(student => {
        if (currentTeam.length >= targetTeamSize) {
            teams.push(currentTeam);
            currentTeam = [];
        }
        currentTeam.push(student);
    });

    if (currentTeam.length > 0) {
        teams.push(currentTeam);
    }
    
    // Logic to handle teams with very few members
    const smallTeamThreshold = Math.floor(targetTeamSize / 2);
    const lastTeam = teams[teams.length - 1];

    if (teams.length > 1 && lastTeam.length <= smallTeamThreshold) {
        const lastTeamMembers = teams.pop() as Student[];
        let memberIndex = 0;
        while(memberIndex < lastTeamMembers.length) {
            for (let i = 0; i < teams.length; i++) {
                if(memberIndex >= lastTeamMembers.length) break;
                if (teams[i].length < targetTeamSize + 2) { // Avoid making teams too large
                    teams[i].push(lastTeamMembers[memberIndex]);
                    memberIndex++;
                }
            }
            // If some members are left (because all teams are full), create a new small team for them.
            if(memberIndex < lastTeamMembers.length && teams.every(t => t.length >= targetTeamSize + 2)) {
                teams.push(lastTeamMembers.slice(memberIndex));
                break;
            }
        }
    }


    return teams;
  };

  const handleGenerateTeams = () => {
    setError(null);
    try {
      const hasPredefinedTeams = students.some(s => s.teamId && s.teamId.trim() !== '');

      const studentsByLevel = students.reduce((acc, student) => {
        const level = student.level || '기타';
        if (!acc[level]) acc[level] = [];
        acc[level].push(student);
        return acc;
      }, {} as Record<string, Student[]>);

      const newTeamsByLevel: TeamsByLevel = {};

      if (hasPredefinedTeams) {
        Object.keys(studentsByLevel).forEach(level => {
          const levelStudents = studentsByLevel[level];
          const teamsMap = levelStudents.reduce((acc, student) => {
            const teamId = student.teamId || '미지정';
            if (!acc[teamId]) acc[teamId] = [];
            acc[teamId].push(student);
            return acc;
          }, {} as Record<string, Student[]>);
          
          newTeamsByLevel[level] = Object.values(teamsMap);
        });
      } else {
        if (teamSize < 2) {
          setError('한 조당 인원은 2명 이상이어야 합니다.');
          return;
        }
        Object.keys(studentsByLevel).forEach(level => {
          newTeamsByLevel[level] = createBalancedTeams(studentsByLevel[level], teamSize);
        });
      }
      
      setTeamsByLevel(newTeamsByLevel);
      setAppState('results');
    } catch(e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '조 편성 중 오류가 발생했습니다.');
    }
  };
  
  const handleAddTeam = (level: string) => {
    setTeamsByLevel(prev => ({
      ...prev,
      [level]: [...(prev[level] || []), []]
    }));
  };
  
  const handleDeleteTeam = (level: string, teamIndex: number) => {
    setTeamsByLevel(prev => {
        const levelTeams = prev[level].filter((_, i) => i !== teamIndex);
        return {...prev, [level]: levelTeams};
    });
    toast({
        title: "조 삭제됨",
        description: `${level} 그룹의 조가 삭제되었습니다.`
    })
  };


  const handleDragStart = (e: DragEvent<HTMLLIElement>, student: Student, sourceLevel: string, sourceTeamIndex: number) => {
    e.dataTransfer.effectAllowed = 'move';
    const dragData: DraggedItem = { student, source: { level: sourceLevel, teamIndex: sourceTeamIndex }};
    setDraggedItem(dragData);
    e.currentTarget.classList.add('opacity-50', 'bg-primary/20');
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };
  
  const handleDragEnd = (e: DragEvent<HTMLLIElement>) => {
    e.currentTarget.classList.remove('opacity-50', 'bg-primary/20');
    setDraggedItem(null);
  };

  const handleDrop = (destLevel: string, destTeamIndex: number) => {
    if (!draggedItem) return;

    const { student, source } = draggedItem;

    if (source.level === destLevel && source.teamIndex === destTeamIndex) {
      return; 
    }
    
    setTeamsByLevel(prev => {
      const newTeams = JSON.parse(JSON.stringify(prev));

      // Remove from source
      const sourceTeam = newTeams[source.level][source.teamIndex];
      const studentIndex = sourceTeam.findIndex((s: Student) => s.id === student.id);
      if (studentIndex > -1) {
        sourceTeam.splice(studentIndex, 1);
      }

      // Add to destination
      const destTeam = newTeams[destLevel][destTeamIndex];
      destTeam.push(student);

      return newTeams;
    });
    
    toast({
        title: "멤버 이동 완료",
        description: `${student.name} 학생이 다른 조로 이동되었습니다.`
    })
  };
  
  const handleAiModalOpen = async (team: Student[]) => {
    setSelectedTeamForAI(team);
    setAiModalOpen(true);
    setIsAiLoading(true);
    setAiSuggestion(null);

    const teamMembersForAI = team.map(({ name, school, level }) => ({ name, school, level }));
    const suggestions = await getAiSuggestions(teamMembersForAI);
    
    setAiSuggestion(suggestions);
    setIsAiLoading(false);
  };
  
  const summary = useMemo(() => {
    if (appState !== 'results') return null;
    const allStudents = Object.values(teamsByLevel).flat(2);
    const total = allStudents.length;
    const maleCount = allStudents.filter(s => s.gender === '남').length;
    const femaleCount = allStudents.filter(s => s.gender === '여').length;

    const levelCounts = Object.keys(teamsByLevel).reduce((acc, level) => {
        acc[level] = teamsByLevel[level].flat().length;
        return acc;
    }, {} as Record<string, number>);

    const regionCounts = allStudents.reduce((acc, s) => { acc[s.region] = (acc[s.region] || 0) + 1; return acc; }, {} as Record<string, number>);
    const schoolCounts = allStudents.reduce((acc, s) => { acc[s.school] = (acc[s.school] || 0) + 1; return acc; }, {} as Record<string, number>);
    
    const levelOrder = ['초등', '중등', '고등', '대학', '기타'];
    const sortedLevels = Object.keys(levelCounts).sort((a,b) => levelOrder.indexOf(a) - levelOrder.indexOf(b));

    return { total, maleCount, femaleCount, levelCounts, regionCounts, schoolCounts, sortedLevels };
  }, [teamsByLevel, appState]);


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">Grouping AI</h1>
        <p className="mt-2 text-lg text-muted-foreground">✨ AI로 스마트하게 조를 편성하고 완벽한 팀워크를 만드세요.</p>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류 발생</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {appState === 'input' && (
        <Card className="w-full max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2"><Users className="text-primary"/>1. 참가자 정보 입력</CardTitle>
            <CardDescription>엑셀이나 명단 정보를 그대로 복사해서 붙여넣으세요. 이전에 내보낸 파일을 붙여넣으면 조 편성이 복원됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="member-data" className="text-base">참가자 정보 붙여넣기</Label>
              <Textarea
                id="member-data"
                rows={12}
                className="text-base"
                placeholder={`예시)\n1. 홍길동, 남, 경기과학고등학교, 경기 수원\n2. 이순신, 남, 남양주초등학교, 서울\n3. 조은하, 여, 양지중학교, 강원`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-size" className="text-base">목표 조당 인원 수</Label>
              <Input
                id="team-size"
                type="number"
                min="2"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-48 text-base"
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={handleAnalyze} className="w-full sm:w-auto text-lg py-6 flex-grow">
              <Wand2 className="mr-2"/> 데이터 분석 및 확인
            </Button>
            <Button onClick={() => setRawText(presetData)} variant="outline" className="w-full sm:w-auto">기본 정보 불러오기</Button>
          </CardFooter>
        </Card>
      )}

      {appState === 'review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">데이터 검토 및 수정</CardTitle>
              <CardDescription>AI가 분석한 데이터입니다. 잘못된 정보가 있다면 표에서 직접 수정해주세요.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>모둠</TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead>이름</TableHead>
                            <TableHead>성별</TableHead>
                            <TableHead>학교</TableHead>
                            <TableHead>학교급</TableHead>
                            <TableHead>지역</TableHead>
                            <TableHead className="text-right">관리</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {students.map((s, i) => (
                            <TableRow key={s.id + i}>
                            <TableCell><Input value={s.teamId} onChange={(e) => handleStudentChange(i, 'teamId', e.target.value)} placeholder="미정"/></TableCell>
                            <TableCell><Input value={s.id} onChange={(e) => handleStudentChange(i, 'id', e.target.value)} /></TableCell>
                            <TableCell><Input value={s.name} onChange={(e) => handleStudentChange(i, 'name', e.target.value)} /></TableCell>
                            <TableCell><Input value={s.gender} onChange={(e) => handleStudentChange(i, 'gender', e.target.value)} /></TableCell>
                            <TableCell><Input value={s.school} onChange={(e) => handleStudentChange(i, 'school', e.target.value)} /></TableCell>
                            <TableCell><Input value={s.level} onChange={(e) => handleStudentChange(i, 'level', e.target.value)} /></TableCell>
                            <TableCell><Input value={s.region} onChange={(e) => handleStudentChange(i, 'region', e.target.value)} /></TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => deleteStudentRow(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
              <Button onClick={addStudentRow} variant="outline" className="mt-4"><PlusCircle className="mr-2 h-4 w-4"/> 인원 추가하기</Button>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setAppState('input'); setError(null); }}>뒤로가기</Button>
            <Button onClick={handleGenerateTeams} className="text-lg py-6">이 정보로 조 편성 시작!</Button>
          </div>
        </div>
      )}

      {appState === 'results' && summary && (
        <div className="space-y-8">
            <div className="flex flex-wrap gap-4 justify-between items-center">
                <h2 className="text-3xl font-bold">조 편성 결과</h2>
                <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => setAppState('review')} variant="secondary">편성 수정하기</Button>
                    <Button onClick={() => exportTeamsToCSV(teamsByLevel)}><FileDown className="mr-2 h-4 w-4"/>결과 내보내기</Button>
                    <Button onClick={() => setSeatingChartModalOpen(true)}><Users className="mr-2 h-4 w-4"/>자리 배치표 보기</Button>
                </div>
            </div>
            
            <Card>
                <CardHeader><CardTitle className="text-2xl flex items-center gap-2"><Info /> 데이터 요약</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="bg-muted/50">
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users /> 총 인원</CardTitle></CardHeader>
                        <CardContent className="text-base space-y-1">
                            <p>총: <span className="font-bold">{summary.total}</span>명</p>
                            <p>남자: <span className="font-bold text-blue-600">{summary.maleCount}</span>명</p>
                            <p>여자: <span className="font-bold text-pink-600">{summary.femaleCount}</span>명</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserSquare /> 학교급별</CardTitle></CardHeader>
                        <CardContent className="text-base space-y-1">
                             {summary.sortedLevels.map(level => <p key={level}>{level}: <span className="font-bold">{summary.levelCounts[level] || 0}</span>명</p>)}
                        </CardContent>
                    </Card>
                     <Card className="bg-muted/50">
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPin /> 지역별</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1 max-h-48 overflow-y-auto">
                            {Object.keys(summary.regionCounts).sort().map(region => <p key={region}>{region}: <span className="font-bold">{summary.regionCounts[region] || 0}</span>명</p>)}
                        </CardContent>
                    </Card>
                     <Card className="bg-muted/50 md:col-span-2 lg:col-span-3">
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building /> 학교별</CardTitle></CardHeader>
                        <CardContent className="text-sm flex flex-wrap gap-x-4 gap-y-1 max-h-48 overflow-y-auto">
                             {Object.keys(summary.schoolCounts).sort().map(school => <p key={school}>{school}: <span className="font-bold">{summary.schoolCounts[school] || 0}</span>명</p>)}
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

          {Object.keys(teamsByLevel).sort((a,b) => ['초등', '중등', '고등', '대학', '기타'].indexOf(a) - ['초등', '중등', '고등', '대학', '기타'].indexOf(b)).map((level) => (
            <div key={level}>
              <h3 className="text-2xl font-bold mb-4">{level} 그룹</h3>
              <Separator className="mb-6"/>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {teamsByLevel[level].map((team, teamIndex) => {
                  const maleCount = team.filter(s => s.gender === '남').length;
                  const femaleCount = team.filter(s => s.gender === '여').length;
                  return (
                    <Card
                      key={teamIndex}
                      className="flex flex-col transition-all hover:shadow-xl"
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(level, teamIndex)}
                    >
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>조 {Object.values(teamsByLevel).flat().indexOf(team) + 1}</CardTitle>
                          <CardDescription>총 {team.length}명 (남:{maleCount}/여:{femaleCount})</CardDescription>
                        </div>
                        {team.length === 0 && <Button variant="ghost" size="icon" onClick={() => handleDeleteTeam(level, teamIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <ul className="space-y-2">
                          {team.map((student) => (
                            <li
                              key={student.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, student, level, teamIndex)}
                              onDragEnd={handleDragEnd}
                              className="flex items-center justify-between p-2 rounded-md bg-muted/50 cursor-move"
                            >
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground"/>
                                  <span className="font-semibold">{student.name}</span>
                                  <Badge variant={student.gender === '남' ? 'default' : 'secondary'} className={student.gender === '여' ? 'bg-pink-200 text-pink-800' : 'bg-blue-200 text-blue-800'}>{student.gender}</Badge>
                                </div>
                                <span className="text-sm text-muted-foreground truncate max-w-[100px]">{student.school}</span>
                            </li>
                          ))}
                           {team.length === 0 && <p className="text-muted-foreground text-center py-4">여기에 멤버를 드래그하세요</p>}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button onClick={() => handleAiModalOpen(team)} className="w-full" disabled={team.length === 0}>
                            <Sparkles className="mr-2 h-4 w-4" /> AI 활동 추천
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
                <Button variant="outline" className="h-full min-h-48 border-dashed border-2 flex-col gap-2" onClick={() => handleAddTeam(level)}>
                  <PlusCircle className="h-8 w-8 text-muted-foreground"/>
                  <span className="text-muted-foreground">조 추가하기</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <Dialog open={isAiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl"><Sparkles className="text-primary"/>AI 활동 추천</DialogTitle>
            </DialogHeader>
            {isAiLoading && <div className="flex items-center justify-center p-8"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>}
            {aiSuggestion && (
                <div className="space-y-6 mt-4">
                    <div>
                        <h4 className="font-semibold text-lg text-muted-foreground">추천 팀 이름</h4>
                        <p className="text-3xl font-bold text-primary">{aiSuggestion.teamName}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-lg text-muted-foreground">아이스브레이킹 질문</h4>
                        <ul className="list-disc list-inside mt-2 space-y-2 text-base">
                            {aiSuggestion.icebreakers.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isSeatingChartModalOpen} onOpenChange={setSeatingChartModalOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle className="text-2xl">모둠 편성 결과 (자리 배치표)</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto p-2">
                {Object.values(teamsByLevel).flat().map((team, i) => (
                    <Card key={i} className="bg-primary/10">
                        <CardHeader className="p-4">
                            <CardTitle className="text-center text-primary">모둠 {i + 1}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <ul className="space-y-1 text-center">
                                {team.map(member => <li key={member.id} className="font-medium">{member.name}</li>)}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
