import { useState } from 'react';
import GradesPage, { GradeEntry } from '../GradesPage';
import type { Student } from '@shared/schema';

export default function GradesPageExample() {
  // Example usage: start with empty data to avoid hard-coded sample records
  const mockStudents: Student[] = [];
  const [grades, setGrades] = useState<GradeEntry[]>([]);

  const handleSaveGrades = (newGrades: GradeEntry[]) => {
    setGrades(prev => [...prev, ...newGrades]);
    console.log('Grades saved:', newGrades);
  };

  return <GradesPage students={mockStudents} grades={grades} onSaveGrades={handleSaveGrades} />;
}
