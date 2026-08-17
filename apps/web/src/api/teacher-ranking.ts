import http from './http';

export interface TeacherRankingRow {
  position: number;
  teacherId: string;
  teacherName: string;
  classrooms: number;
  metrics: {
    plannings: number;
    conferences: number;
    diaries: number;
    observations: number;
    conferencesFeitas: number;
    diariesPublicados: number;
    observationsRicas: number;
  };
  completeness: number;
  quality: number;
  total: number;
}

export interface TeacherRankingResponse {
  from: string;
  to: string;
  formula: {
    completeness: string;
    quality: string;
    total: string;
    note: string;
  };
  rankings: TeacherRankingRow[];
}

export async function getTeacherRanking(params?: { from?: string; to?: string; unitId?: string }) {
  const response = await http.get<TeacherRankingResponse>('/teacher-ranking', { params });
  return response.data;
}
