import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RotateCcw, FileText } from 'lucide-react';
import type { Student } from '@shared/schema';
import TransferCertificateModal from './TransferCertificateModal';

interface WithdrawnStudentsPageProps {
  students: Student[]; // expects status==='left'
  onRestore?: (admissionNumber: string) => Promise<void> | void;
}

export default function WithdrawnStudentsPage({ students, onRestore }: WithdrawnStudentsPageProps) {
  const [selectedStudentForTC, setSelectedStudentForTC] = useState<Student | null>(null);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Withdrawn Students</h1>
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
              <TableHead>Withdrawal Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students have been marked as withdrawn yet.</TableCell>
              </TableRow>
            ) : students.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.admissionNumber}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.grade}</TableCell>
                <TableCell>{s.section}</TableCell>
                <TableCell>{s.leftDate || '—'}</TableCell>
                <TableCell>{s.leavingReason || '—'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedStudentForTC(s)}
                    title="Generate TC"
                    className="gap-1"
                  >
                    <FileText className="w-4 h-4" />
                    TC
                  </Button>
                  {onRestore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const confirmRestore = window.confirm(`Restore student ${s.name} (Admission ${s.admissionNumber}) to active status?`);
                        if (!confirmRestore) return;
                        try {
                          await onRestore(s.admissionNumber);
                        } catch (e: any) {
                          alert(e?.message || 'Failed to restore student');
                        }
                      }}
                      title="Restore to Active"
                      className="gap-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TransferCertificateModal
        open={!!selectedStudentForTC}
        onClose={() => setSelectedStudentForTC(null)}
        student={selectedStudentForTC}
      />
    </div>
  );
}