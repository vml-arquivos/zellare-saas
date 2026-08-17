import http from './http';

export interface GlobalStats {
  scope: 'MANTENEDORA';
  totalUnits: number;
  totalStudents: number;
  totalTeachers: number;
  activeEnrollments: number;
  monthlyRevenue: number | null;
  pendingRequests: number;
  completedActivities: number;
  avgAttendance: number;
  criticalAlerts: number;
  units: Array<{ name: string; students: number }>;
  monthlyData: Array<{ month: string; students: number; revenue: number | null; activities: number }>;
  revenueAvailable: boolean;
  generatedAt: string;
}

export async function getGlobalStats() {
  const response = await http.get<GlobalStats>('/admin/global-stats');
  return response.data;
}
