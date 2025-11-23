import Dashboard from '../Dashboard';

export default function DashboardExample() {
  const mockStats = {
    totalStudents: 245,
    pendingFees: 12500,
    gradesEntered: 156,
    avgAttendance: 94
  };

  return <Dashboard stats={mockStats} userRole="admin" />;
}
