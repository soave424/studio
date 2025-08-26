export type Student = {
  teamId: string;
  id: string;
  name: string;
  gender: '남' | '여' | string;
  school: string;
  level: '초등' | '중등' | '고등' | '대학' | '기타' | string;
  region: string;
};

export type TeamsByLevel = Record<string, Student[][]>;

export type DraggedItem = {
  student: Student;
  source: {
    level: string;
    teamIndex: number;
  };
};
