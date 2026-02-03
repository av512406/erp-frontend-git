import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { Student } from "@shared/schema";
import type { ImportSummary, RawStudentRow, GradeEntry } from "@/types";
import { formatCsvDate } from "@/lib/import-parsers";
import StudentsExcelExportModal from './StudentsExcelExportModal';

import { StudentImportCard } from "./imports/StudentImportCard";
import { GradeImportCard } from "./imports/GradeImportCard";
import { TransactionImportCard } from "./imports/TransactionImportCard";
import { DataExportCard } from "./imports/DataExportCard";
import { DataBackupCard } from "./imports/DataBackupCard";

interface DataToolsPageProps {
  students: Student[];
  onImportStudents: (students: Omit<Student, 'id'>[], targetSessionId?: string) => Promise<ImportSummary> | ImportSummary;
  onUpsertStudents: (students: Omit<Student, 'id'>[]) => Promise<{ updated: number }> | { updated: number };
  onImportGrades: (grades: GradeEntry[]) => Promise<void> | void;
  onImportTransactions?: (transactions: any[]) => Promise<any> | any;
  sessions: { id: string; name: string }[];
  selectedSessionId?: string;
}

export default function DataToolsPage({ students, onImportStudents, onUpsertStudents, onImportGrades, onImportTransactions, sessions, selectedSessionId }: DataToolsPageProps) {
  const [importSessionId, setImportSessionId] = useState<string>(selectedSessionId || "");
  const { toast } = useToast();

  // State for result display inside this page (can be moved to separate component later)
  const [skippedAdmissions, setSkippedAdmissions] = useState<string[] | null>(null);
  const [skippedRows, setSkippedRows] = useState<RawStudentRow[] | null>(null);
  const [skippedTransactions, setSkippedTransactions] = useState<any[] | null>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);

  // Sync importSessionId
  useEffect(() => {
    if (selectedSessionId) {
      setImportSessionId(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleStudentImportComplete = (summary: ImportSummary, valid: RawStudentRow[], invalid: any[]) => {
    const allSkipped = [
      ...(summary.skippedAdmissionNumbers || []),
      ...invalid.map(r => `[Invalid] Row ${r._index}: ${r._error}`)
    ];
    if (allSkipped.length > 0) {
      setSkippedAdmissions(allSkipped);
      // Construct skippedRows for export/upsert
      const skippedData = [
        ...(invalid as any),
        ...(valid.filter(s => summary.skippedAdmissionNumbers?.includes(s.admissionNumber)))
      ];
      setSkippedRows(skippedData);
    }
  };

  const handleTransactionImportComplete = (summary: any, imported: any[], skipped: any[]) => {
    if (skipped && skipped.length > 0) {
      setSkippedTransactions(skipped);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Tools</h1>
        <p className="text-muted-foreground mb-4">Import, export, and manage bulk data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudentImportCard
          students={students}
          onImportStudents={onImportStudents}
          importSessionId={importSessionId}
          setImportSessionId={setImportSessionId}
          sessions={sessions}
          onImportComplete={handleStudentImportComplete}
        />

        <GradeImportCard
          students={students}
          onImportGrades={onImportGrades}
        />

        <TransactionImportCard
          students={students}
          onImportTransactions={onImportTransactions}
          onImportComplete={handleTransactionImportComplete}
        />

        <div className="space-y-6">
          <DataExportCard
            students={students}
            onOpenExcelExport={() => setExcelModalOpen(true)}
          />
          <DataBackupCard />
        </div>
      </div>

      <StudentsExcelExportModal
        open={excelModalOpen}
        onOpenChange={setExcelModalOpen}
        students={students}
      />

      {/* Skipped Results Dialogs (Legacy Logic Preserved for Feature Parity) */}
      <AlertDialog open={!!skippedAdmissions} onOpenChange={() => setSkippedAdmissions(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Report: Skipped Records</AlertDialogTitle>
            <AlertDialogDescription>
              The following records were skipped due to errors or duplicates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto mt-2">
            <ul className="list-disc pl-6">
              {skippedAdmissions?.map((adm, i) => (
                <li key={i} className="font-mono text-sm">{adm}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (!skippedRows || skippedRows.length === 0) return;
                const header = ['admissionNumber', 'name', 'fatherName', 'motherName', 'dateOfBirth', 'admissionDate', 'aadharNumber', 'penNumber', 'aaparId', 'mobileNumber', 'address', 'class', 'section', 'yearlyFeeAmount', 'previousYearDue', 'category', 'gender'];
                const rows = skippedRows.map(r => [
                  r.admissionNumber,
                  `"${(r.name || '').replace(/"/g, '""')}"`,
                  r.fatherName || '',
                  r.motherName || '',
                  formatCsvDate(r.dateOfBirth || ''),
                  formatCsvDate(r.admissionDate || ''),
                  r.aadharNumber || '',
                  r.penNumber || '',
                  r.aaparId || '',
                  r.mobileNumber || '',
                  `"${(r.address || '').replace(/"/g, '""')}"`,
                  r.grade || '',
                  r.section || '',
                  r.yearlyFeeAmount || '',
                  r.previousYearDue || '',
                  r.category || '',
                  r.gender || ''
                ].join(','));
                const csv = [header.join(','), ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `skipped-students-${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
              }}
            >
              Export Skipped CSV
            </Button>
            <Button
              onClick={async () => {
                if (!skippedRows || skippedRows.length === 0) return;
                const result = await onUpsertStudents(skippedRows as any);
                toast({ title: 'Upsert completed', description: `Updated ${result.updated} records` });
                setSkippedAdmissions(null);
                setSkippedRows(null);
              }}
            >
              Upsert Existing Records
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!skippedTransactions} onOpenChange={() => setSkippedTransactions(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skipped Transactions</AlertDialogTitle>
            <AlertDialogDescription>
              The following transaction rows were skipped during import.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto mt-2">
            <ul className="list-disc pl-6">
              {skippedTransactions?.map((r, idx) => (
                <li key={idx} className="font-mono text-sm">{r.index != null ? `Row ${r.index}` : JSON.stringify(r)} — {r.reason || ''}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 mt-4">
            {/* Simple Export for Transactions */}
            <Button
              variant="outline"
              onClick={() => {
                if (!skippedTransactions || skippedTransactions.length === 0) return;
                const header = ['index', 'reason', 'raw'];
                const rows = skippedTransactions.map(r => [
                  r.index ?? '',
                  (r.reason || '').replace(/"/g, '""'),
                  '"' + JSON.stringify(r.row || {}) + '"'
                ].join(','));
                const csv = [header.join(','), ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `skipped-transactions-${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
              }}
            >
              Export Skipped CSV
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
