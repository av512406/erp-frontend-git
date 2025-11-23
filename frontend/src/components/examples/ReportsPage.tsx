import ReportsPage from '../ReportsPage';
import type { Student } from '@shared/schema';
import type { GradeEntry } from '../GradesPage';

export default function ReportsPageExample() {
  const mockStudents: Student[] = [];
  const mockGrades: GradeEntry[] = [];

  return <ReportsPage students={mockStudents} grades={mockGrades} />;
}
