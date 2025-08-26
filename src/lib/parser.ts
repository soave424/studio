import type { Student } from '@/types';

export function parseStudentInfo(line: string, lineIndex: number): Student {
  const parts = line.split(/[,\t]/).map(s => s.trim()).filter(Boolean);
  let id = '', name = '', gender = '', school = '', level = '', region = '', teamId = '';
  let remainingParts = [...parts];

  const levelMap: Record<string, string> = { '초': '초등', '중': '중등', '고': '고등', '대': '대학', '초등학교': '초등', '중학교': '중등', '고등학교': '고등', '대학교': '대학', '기타': '기타' };
  const schoolKeywords = ['학교', '캠퍼스', '센터', '초', '중', '고'];
  const KOREAN_CITIES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '수원', '용인', '고양', '성남', '부천', '화성', '안산', '남양주', '안양', '평택', '의정부', '파주', '시흥', '김포', '광명', '군포', '오산', '이천', '양주', '구리', '안성', '포천', '의왕', '하남', '여주', '동두천', '과천', '청주', '충주', '제천', '천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '전주', '군산', '익산', '정읍', '남원', '김제', '목포', '여수', '순천', '나주', '광양', '포항', '경주', '김천', '안동', '구미', '영주', '상주', '문경', '경산', '창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '제주', '서귀포'];
  const KOREAN_PROVINCES = ['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];

  let tempParts: string[] = [];
  const numbers: string[] = [];
  for (const p of remainingParts) {
    if (/^\d+$/.test(p)) {
      numbers.push(p);
    } else if ((p === '남' || p === '여') && !gender) {
      gender = p;
    } else {
      tempParts.push(p);
    }
  }
  remainingParts = tempParts;
  if (numbers.length > 1) { teamId = numbers[0]; id = numbers[1]; } 
  else if (numbers.length === 1) { id = numbers[0]; }


  const nameRegex = /^[가-힣]{2,4}$/;
  const nameIndex = remainingParts.findIndex(p => nameRegex.test(p) && !levelMap[p] && !KOREAN_PROVINCES.includes(p) && !KOREAN_CITIES.includes(p));
  if (nameIndex > -1) {
    name = remainingParts[nameIndex];
    remainingParts.splice(nameIndex, 1);
  }

  const schoolCandidateIndex = remainingParts.findIndex(p => schoolKeywords.some(kw => p.includes(kw)));
  if (schoolCandidateIndex > -1) {
    school = remainingParts[schoolCandidateIndex];
    remainingParts.splice(schoolCandidateIndex, 1);
  }

  const regionParts: string[] = [];
  tempParts = [];
  for (const p of remainingParts) {
    const isRegion = KOREAN_PROVINCES.some(prov => p.startsWith(prov)) || KOREAN_CITIES.some(city => p.includes(city));
    if (isRegion) {
      regionParts.push(p);
    } else if (levelMap[p] && !level) {
      level = levelMap[p];
    } else {
      tempParts.push(p);
    }
  }
  remainingParts = tempParts;
  if (regionParts.length > 0) region = regionParts.join(' ');


  if (remainingParts.length > 0) {
    if (!school) {
      remainingParts.sort((a, b) => b.length - a.length);
      school = remainingParts.shift() || '';
    }
    if (!name && remainingParts.length > 0) {
      name = remainingParts.join(' ');
    }
  }

  if (!id) id = (lineIndex + 1).toString();
  if (!level && school) {
    if (school.includes('초등') || school.includes('초등학교')) level = '초등';
    else if (school.includes('중학') || school.includes('중학교')) level = '중등';
    else if (school.includes('고등') || school.includes('고등학교')) level = '고등';
    else if (school.includes('대학') || school.includes('대학교')) level = '대학';
  }
  if (!level) level = '기타';
  if (!region) region = '미분류';
  if (!name) name = `참가자-${id}`;
  if (!gender) gender = '기타';
  if (!school) school = '미분류';

  return { teamId, id, name, gender, school, level, region };
}
