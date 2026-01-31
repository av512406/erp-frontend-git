import Dashboard from '../Dashboard';

export default function DashboardExample() {
  const mockStats = { totalStudents: 100, pendingFees: 50000, gradesEntered: 85, avgAttendance: 92, feesCollectedToday: 0 };

  return <Dashboard stats={mockStats} userRole="admin" />;
}
