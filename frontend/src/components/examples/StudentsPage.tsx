import { useState } from 'react';
import StudentsPage from '../StudentsPage';
import type { Student } from '@shared/schema';

export default function StudentsPageExample() {
  const [students, setStudents] = useState<Student[]>([]);

  const handleAdd = (student: Omit<Student, 'id'>) => {
    setStudents(prev => [...prev, { ...student, id: Date.now().toString() }]);
  };

  const handleEdit = (id: string, student: Omit<Student, 'id'>) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...student, id } : s));
  };

  const handleDelete = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  return (
    <StudentsPage
      students={students}
      onAddStudent={handleAdd}
      onEditStudent={handleEdit}
      onDeleteStudent={handleDelete}
    />
  );
}
