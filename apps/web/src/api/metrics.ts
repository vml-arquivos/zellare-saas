import http from './http';

export interface CoverageOverview {
  scope: 'UNIDADE' | 'MANTENEDORA';
  unitId: string | null;
  period: { days: number; from: string; to: string };
  population: { units: number; classrooms: number; children: number; enrollments: number; teachers: number };
  activity: { diaryEvents: number; publishedDiaryEvents: number; observations: number; publishedReports: number; familyMessages: number };
  care: { activeAlerts: number; childrenWithActiveAlert: number; childrenWithDietaryRestriction: number; activeGuardians: number; developmentConsents: number };
  coverage: { childrenWithObservation: number; childrenWithFamilyLink: number; childrenWithDevelopmentConsent: number; childrenWithActiveAlert: number };
  daily: Array<{ date: string; diary: number; access: number }>;
  governance: { generatedAt: string; containsChildContent: boolean; containsPersonalData: boolean; readOnly: boolean };
}

export async function getCoverageOverview(days = 30) {
  const response = await http.get<CoverageOverview>('/metrics/coverage', { params: { days } });
  return response.data;
}
