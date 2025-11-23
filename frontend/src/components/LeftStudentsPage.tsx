import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Student } from '@shared/schema';

interface LeftStudentsPageProps {
  students: Student[]; // expects already filtered to status==='left'
}

export default function LeftStudentsPage({ students }: LeftStudentsPageProps) {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Students Who Left</h1>
        <p className="text-muted-foreground">Historical list of students who are no longer enrolled.</p>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Left Date</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students have been marked as left yet.</TableCell>
              </TableRow>
            ) : students.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.admissionNumber}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.grade}</TableCell>
                <TableCell>{s.section}</TableCell>
                <TableCell>{s.leftDate || '—'}</TableCell>
                <TableCell>{s.leavingReason || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}