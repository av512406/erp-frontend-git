import DataToolsPage from '../DataToolsPage';
import type { Student } from '@shared/schema';
import type { GradeEntry } from '../GradesPage';

export default function DataToolsPageExample() {
  // start with no sample students in examples
  const mockStudents: Student[] = [];

  const handleImportStudents = (students: Omit<Student, 'id'>[]) => {
    console.log('Importing students:', students);
    return { added: students.length, skipped: 0 };
  };

  const handleImportGrades = (grades: GradeEntry[]) => {
    console.log('Importing grades:', grades);
  };

  const handleUpsertStudents = (students: Omit<Student, 'id'>[]) => {
    console.log('Upserting students:', students);
    return { updated: students.length };
  };

  return (
    <DataToolsPage
      students={mockStudents}
      onImportStudents={handleImportStudents}
      onImportGrades={handleImportGrades}
      onUpsertStudents={handleUpsertStudents}
    />
  );
}
