import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
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
import StudentsExcelExportModal from './StudentsExcelExportModal';
import type { GradeEntry } from "./GradesPage";

// Utility: consistently format date fields as YYYY-MM-DD for CSV (strip time if present)
const formatCsvDate = (value: string | undefined | null): string => {
  if (!value) return '';
  // If already YYYY-MM-DD just return
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // If ISO timestamp, take first 10 chars
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  // Try Date parse fallback
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return value; // leave as-is (will surface for correction)
};

interface ImportSummary {
  added: number;
  skipped: number;
  skippedAdmissionNumbers?: string[];
}

type RawStudentRow = {
  admissionNumber: string;
  name: string;
  dateOfBirth?: string;
  admissionDate?: string;
  aadharNumber?: string;
  penNumber?: string;
  aaparId?: string;
  mobileNumber?: string;
  address?: string;
  grade?: string;
  section?: string;
  fatherName?: string; // added
  motherName?: string; // added
  yearlyFeeAmount?: string;
};

interface DataToolsPageProps {
  students: Student[];
  // returns a summary of import (added/skipped)
  onImportStudents: (students: Omit<Student, 'id'>[]) => Promise<ImportSummary> | ImportSummary;
  // upsert existing students (update existing records by admissionNumber)
  onUpsertStudents: (students: Omit<Student, 'id'>[]) => Promise<{ updated: number }> | { updated: number };
  onImportGrades: (grades: GradeEntry[]) => Promise<void> | void;
  onImportTransactions?: (transactions: { studentId: string; amount: string; paymentDate: string; paymentMode?: string; remarks?: string }[]) => Promise<{ inserted: number; skipped: number; skippedRows?: any[] }> | { inserted: number; skipped: number; skippedRows?: any[] };
  // optional: load demo data (for admin/testing)
  onLoadDemoData?: (count?: number) => void;
}

declare global {
  interface Window {
    Papa: any;
  }
}

export default function DataToolsPage({ students, onImportStudents, onUpsertStudents, onImportGrades, onImportTransactions, onLoadDemoData }: DataToolsPageProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [exportFilter, setExportFilter] = useState<string>("all");
  const [templateGrade, setTemplateGrade] = useState<string>("all");
  const studentFileRef = useRef<HTMLInputElement>(null);
  const gradesFileRef = useRef<HTMLInputElement>(null);
  const transactionsFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [skippedAdmissions, setSkippedAdmissions] = useState<string[] | null>(null);
  const [lastImportedRows, setLastImportedRows] = useState<RawStudentRow[] | null>(null);
  const [skippedRows, setSkippedRows] = useState<RawStudentRow[] | null>(null);
  const [skippedTransactions, setSkippedTransactions] = useState<any[] | null>(null);
  const [lastImportedTransactions, setLastImportedTransactions] = useState<any[] | null>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);

  // Get unique grades for filter dropdown
  const uniqueGrades = Array.from(new Set(students.map(s => s.grade)))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const handleStudentImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      window.Papa.parse(csv, {
        header: true,
        complete: async (results: any) => {
          const normalize = (val: any) => typeof val === 'string' ? val.trim() : (val ?? '');
          const normalizeNumberString = (val: any) => {
            const s = String(val ?? '').replace(/,/g, '').trim();
            return s;
          };
          const excelSerialToDate = (num: number) => {
            // Excel serial date: days since 1899-12-31 (with 1900 leap-year bug). Use 25569 offset to Unix epoch days.
            // If the value is too small, return null.
            if (!isFinite(num) || num <= 0) return null;
            const epoch = new Date(Date.UTC(1899, 11, 30)); // Excel base
            const ms = epoch.getTime() + Math.round(num) * 24 * 60 * 60 * 1000;
            return new Date(ms);
          };
          const toYMD = (d: Date) => {
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };
          const normalizeDate = (raw: any) => {
            const v = normalize(raw);
            if (!v) return '';
            // already YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
            // ISO timestamp e.g. 2023-05-01T00:00:00
            if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
            // Excel serial number (common when CSV exported from Excel)
            const asNum = Number(String(v).replace(/\s+/g, ''));
            if (!Number.isNaN(asNum) && isFinite(asNum) && asNum > 59 && asNum < 60000) {
              const d = excelSerialToDate(asNum);
              if (d) return toYMD(d);
            }

            // Common human formats: dd/mm/yyyy or d/m/yyyy or dd-mm-yyyy or dd.mm.yyyy
            const dmy = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
            if (dmy) {
              let p1 = parseInt(dmy[1], 10);
              let p2 = parseInt(dmy[2], 10);
              let p3 = parseInt(dmy[3], 10);
              let day: number, month: number, year: number;
              year = p3 < 100 ? 2000 + p3 : p3;
              // If first segment > 12 -> assume day/month/year
              if (p1 > 12) {
                day = p1; month = p2;
              } else if (p2 > 12) {
                // e.g. 05/14/2010 -> assume month/day/year
                day = p2; month = p1;
              } else {
                // ambiguous (both <=12) — prefer day/month (common outside US)
                day = p1; month = p2;
              }
              // basic validation
              if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              }
            }

            // Try Date.parse for other reasonable formats (MM/DD/YYYY, Month names etc.)
            const parsed = new Date(v);
            if (!isNaN(parsed.getTime())) return toYMD(new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())));

            // last resort: return original string (server may reject invalid dates)
            return v;
          };

          const importedStudents = results.data
            .filter((row: any) => (row.admissionNumber || row['Admission Number'] || row['AdmissionNo'] || row['Admission No'] || row['admission no']) && (row.name || row['Name']))
            .map((row: any) => {
              const admissionNumber = normalize(row.admissionNumber || row['Admission Number'] || row['AdmissionNo'] || row['Admission No'] || row['admission no']);
              const name = normalize(row.name || row['Name']);
              const dateOfBirth = normalizeDate(row.dateOfBirth || row['date of birth'] || row['Date of Birth'] || row['dob']);
              const admissionDate = normalizeDate(row.admissionDate || row['Admission Date'] || row['admission date']);
              const aadharNumber = normalize(row.aadharNumber || row['Aadhar Number'] || row['aadhar']);
              const penNumber = normalize(row.penNumber || row['PEN Number'] || row['pen']);
              const aaparId = normalize(row.aaparId || row['Aapar ID'] || row['aapar']);
              const mobileNumber = normalize(row.mobileNumber || row['Mobile'] || row['Phone'] || row['mobile']);
              const address = normalize(row.address || row['Address']);
              const grade = normalize(row.grade || row['class'] || row['Class']);
              const section = normalize(row.section || row['Section']);
              const yfaRaw = row.yearlyFeeAmount ?? row['Yearly fees'] ?? row['Yearly Fees'] ?? row['yearly fees'] ?? row['Yearly_Fees'] ?? row['YearlyFee'] ?? row['yearlyFeeAmount'];
              const yearlyFeeAmount = yfaRaw === undefined || yfaRaw === null ? '' : normalizeNumberString(yfaRaw);
              const fatherName = normalize(row.fatherName || row["Father's Name"] || row['Father Name'] || row['father'] || row['Fathers Name']);
              const motherName = normalize(row.motherName || row["Mother's Name"] || row['Mother Name'] || row['mother'] || row['Mothers Name']);
              return {
                admissionNumber,
                name,
                dateOfBirth,
                admissionDate,
                aadharNumber,
                penNumber,
                aaparId,
                mobileNumber,
                address,
                grade,
                section,
                fatherName,
                motherName,
                yearlyFeeAmount,
              };
            });
          // keep a copy of raw parsed rows for review/export/upsert
          setLastImportedRows(importedStudents as RawStudentRow[]);
          const summary = await onImportStudents(importedStudents);
          toast({
            title: "Import Finished",
            description: `Added ${summary.added} students, skipped ${summary.skipped} duplicates`,
          });
          if (summary.skipped && summary.skippedAdmissionNumbers && summary.skippedAdmissionNumbers.length) {
            setSkippedAdmissions(summary.skippedAdmissionNumbers);
            // prepare skipped rows to allow export/upsert
            const skipped = importedStudents.filter((r: RawStudentRow) => summary.skippedAdmissionNumbers!.includes(r.admissionNumber));
            setSkippedRows(skipped);
          }
          setIsImporting(false);
          if (studentFileRef.current) studentFileRef.current.value = '';
        }
      });
    };
    reader.readAsText(file);
  };

  const handleGradesImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      window.Papa.parse(csv, {
        header: true,
        complete: (results: any) => {
          const importedGrades = results.data
            .filter((row: any) => row.studentId && row.subject && row.marks && row.term)
            .map((row: any) => ({
              studentId: row.studentId,
              subject: row.subject,
              marks: parseFloat(row.marks),
              term: row.term
            }));
          onImportGrades(importedGrades);
          toast({
            title: "Import Successful",
            description: `Imported ${importedGrades.length} grade entries`,
          });
          setIsImporting(false);
          if (gradesFileRef.current) gradesFileRef.current.value = '';
        }
      });
    };
    reader.readAsText(file);
  };

  const handleTransactionsImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      window.Papa.parse(csv, {
        header: true,
        complete: async (results: any) => {
          const normalize = (val: any) => typeof val === 'string' ? val.trim() : (val ?? '');
          const normalizeNumberString = (val: any) => String((String(val ?? '')).replace(/,/g, '').trim());
          const imported = results.data
            .map((row: any, idx: number) => {
              const admissionNumber = normalize(row.admissionNumber || row['Admission Number']);
              const studentId = normalize(row.studentId || row.studentId) || (admissionNumber ? (students.find(s => s.admissionNumber === admissionNumber)?.id || '') : '');
              const amount = normalizeNumberString(row.amount || row.Amount || row.AMOUNT);
              const paymentDateRaw = normalize(row.paymentDate || row['paymentDate'] || row['Payment Date'] || row.payment_date);
              const paymentDate = formatCsvDate(paymentDateRaw);
              const paymentMode = normalize(row.paymentMode || row['paymentMode'] || row['Payment Mode']) || 'cash';
              const remarks = normalize(row.remarks || row.Remarks || '');
              return { studentId, admissionNumber, amount, paymentDate, paymentMode, remarks, _raw: row, _index: idx };
            })
            .filter((r: any) => r.studentId && r.amount && r.paymentDate);

          try {
            let summary: any = null;
            if (typeof (onImportTransactions as any) === 'function') {
              summary = await (onImportTransactions as any)(imported.map((r: any) => ({ studentId: r.studentId, amount: r.amount, paymentDate: r.paymentDate, paymentMode: r.paymentMode, remarks: r.remarks })));
            } else {
              const res = await fetch('/api/fees/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(imported.map((r: any) => ({ studentId: r.studentId, amount: r.amount, paymentDate: r.paymentDate, paymentMode: r.paymentMode, remarks: r.remarks }))) });
              if (!res.ok) throw new Error('Import failed');
              summary = await res.json();
            }
            toast({ title: 'Import Finished', description: `Inserted ${summary.inserted || 0} transactions, skipped ${summary.skipped || 0}` });
            setLastImportedTransactions(imported as any[]);
            setSkippedTransactions(summary.skippedRows || []);
          } catch (err: any) {
            toast({ title: 'Import error', description: err?.message || 'Failed to import transactions', variant: 'destructive' });
          }

          setIsImporting(false);
          if (transactionsFileRef.current) transactionsFileRef.current.value = '';
        }
      });
    };
    reader.readAsText(file);
  };

  const handleExportStudents = () => {
    // Filter students based on selected filter
    const filteredStudents = exportFilter === "all" 
      ? students 
      : students.filter(s => s.grade === exportFilter);

    const csvContent = [
      ['admissionNumber','name','fatherName','motherName','dateOfBirth','admissionDate','aadharNumber','penNumber','aaparId','mobileNumber','address','class','section','yearlyFeeAmount'].join(','),
      ...filteredStudents.map(s => [
        s.admissionNumber,
        s.name,
        s.fatherName || '',
        s.motherName || '',
        formatCsvDate(s.dateOfBirth),
        formatCsvDate(s.admissionDate),
        s.aadharNumber,
        s.penNumber,
        s.aaparId,
        s.mobileNumber,
        s.address,
        s.grade,
        s.section,
        s.yearlyFeeAmount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
  const filterSuffix = exportFilter === "all" ? "all" : `class-${exportFilter}`;
  a.download = `students-${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredStudents.length} student${filteredStudents.length === 1 ? '' : 's'}`,
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        {/* Demo data loader for admins/testing. Shown when parent provides handler. */}
        {typeof onLoadDemoData === 'function' && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                const ok = confirm('Load demo data (adds ~50 sample students, transactions and grades) into your local app state? This will overwrite current in-memory lists.');
                if (ok) onLoadDemoData();
              }}
            >
              Load Demo Data
            </Button>
          </div>
        )}
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Data Tools</h1>
        <p className="text-muted-foreground">Import and export data in bulk</p>
      </div>

      {/* Skipped duplicates dialog */}
      <AlertDialog open={!!skippedAdmissions} onOpenChange={() => setSkippedAdmissions(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skipped Duplicate Students</AlertDialogTitle>
            <AlertDialogDescription>
              The following admission numbers were skipped because they already exist in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto mt-2">
            <ul className="list-disc pl-6">
              {skippedAdmissions?.map(adm => (
                <li key={adm} className="font-mono">{adm}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                // export skipped rows as CSV if available
                if (!skippedRows || skippedRows.length === 0) return;
                const header = ['admissionNumber','name','fatherName','motherName','dateOfBirth','admissionDate','aadharNumber','penNumber','aaparId','mobileNumber','address','class','section','yearlyFeeAmount'];
                const rows = skippedRows.map(r => [
                  r.admissionNumber,
                  `"${(r.name||'').replace(/"/g, '""') }"`,
                  r.fatherName || '',
                  r.motherName || '',
                  formatCsvDate(r.dateOfBirth || ''),
                  formatCsvDate(r.admissionDate || ''),
                  r.aadharNumber || '',
                  r.penNumber || '',
                  r.aaparId || '',
                  r.mobileNumber || '',
                  `"${(r.address||'').replace(/"/g,'""') }"`,
                  r.grade || '',
                  r.section || '',
                  r.yearlyFeeAmount || ''
                ].join(','));
                const csv = [header.join(','), ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `skipped-students-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
            >
              Export Skipped CSV
            </Button>
            <Button
              onClick={async () => {
                // upsert skipped rows (update existing records)
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
            <AlertDialogAction onClick={() => setSkippedAdmissions(null)}>Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skipped transactions dialog */}
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
                <li key={idx} className="font-mono">{r.index != null ? `Row ${r.index}` : JSON.stringify(r)} — {r.reason || ''}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (!skippedTransactions || skippedTransactions.length === 0) return;
                const header = ['index','reason','raw'];
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
            <Button onClick={() => setSkippedTransactions(null)}>Close</Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => setSkippedTransactions(null)}>Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Students</CardTitle>
            <CardDescription>
              Upload a CSV file to bulk import student records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-grade">Template Class (optional)</Label>
              <Select value={templateGrade} onValueChange={setTemplateGrade}>
                <SelectTrigger id="template-grade">
                  <SelectValue placeholder="Select class for template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {uniqueGrades.map(g => (
                    <SelectItem key={g} value={g}>Class {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-file">CSV File</Label>
              <Input
                id="student-file"
                type="file"
                accept=".csv"
                ref={studentFileRef}
                onChange={handleStudentImport}
                disabled={isImporting}
                data-testid="input-import-students"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Accepted columns (case-insensitive):</p>
              <p className="font-mono text-xs">admissionNumber, name, fatherName or "Father's Name", motherName or "Mother's Name", dateOfBirth, admissionDate, aadharNumber, penNumber, aaparId, mobileNumber, address, grade or class, section, yearlyFeeAmount or "Yearly fees"</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => studentFileRef.current?.click()}
                disabled={isImporting}
                data-testid="button-import-students"
              >
                <Upload className="w-4 h-4" />
                {isImporting ? 'Importing...' : 'Select File'}
              </Button>
              <Button
                variant="ghost"
                className="w-full gap-2"
                onClick={() => {
                  // generate template for selected templateGrade
                  const filtered = templateGrade === 'all' ? students : students.filter(s => s.grade === templateGrade);
                  const header = ['admissionNumber','name','fatherName','motherName','dateOfBirth','admissionDate','aadharNumber','penNumber','aaparId','mobileNumber','address','class','section','yearlyFeeAmount'];
                  // Template with one sample row illustrating date format (YYYY-MM-DD)
                  const sample = [
                    'STU001',
                    'Sample Student',
                    'Sample Father Name',
                    'Sample Mother Name',
                    '2010-05-14', // dateOfBirth (YYYY-MM-DD)
                    '2022-03-31', // admissionDate (YYYY-MM-DD)
                    '1234-5678-9012',
                    'PEN000001',
                    'AAP001',
                    '555-0100',
                    '123 Sample Street',
                    '10',
                    'A',
                    '25000'
                  ].join(',');
                  const csv = [header.join(','), sample].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `students-template-${templateGrade === 'all' ? 'all' : 'class-' + templateGrade}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                data-testid="button-download-students-template"
              >
                <Download className="w-4 h-4" />
                Download Template
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => studentFileRef.current?.click()}
              disabled={isImporting}
              data-testid="button-import-students"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Importing...' : 'Select File'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Class Marks</CardTitle>
            <CardDescription>
              Upload a CSV file to bulk import student marks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grades-file">CSV File</Label>
              <Input
                id="grades-file"
                type="file"
                accept=".csv"
                ref={gradesFileRef}
                onChange={handleGradesImport}
                disabled={isImporting}
                data-testid="input-import-grades"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Expected columns:</p>
              <p className="font-mono text-xs">studentId, subject, marks, term</p>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => gradesFileRef.current?.click()}
              disabled={isImporting}
              data-testid="button-import-grades"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Importing...' : 'Select File'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Transactions</CardTitle>
            <CardDescription>
              Upload a CSV to bulk import fee transactions (studentId or admissionNumber supported)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transactions-file">CSV File</Label>
              <Input
                id="transactions-file"
                type="file"
                accept=".csv"
                ref={transactionsFileRef}
                onChange={handleTransactionsImport}
                disabled={isImporting}
                data-testid="input-import-transactions"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Accepted columns (case-insensitive):</p>
              <p className="font-mono text-xs">studentId or admissionNumber, amount, paymentDate, paymentMode (optional), remarks (optional)</p>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => transactionsFileRef.current?.click()}
              disabled={isImporting}
              data-testid="button-import-transactions"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Importing...' : 'Select File'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Students</CardTitle>
            <CardDescription>
              Download student data as a CSV file with filters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-filter">Filter by Class</Label>
              <Select
                value={exportFilter}
                onValueChange={setExportFilter}
                data-testid="select-export-filter"
              >
                <SelectTrigger id="export-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {uniqueGrades.map(grade => (
                    <SelectItem key={grade} value={grade}>
                      Class {grade} only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Button
                className="w-full gap-2"
                onClick={handleExportStudents}
                disabled={students.length === 0}
                data-testid="button-export-students"
              >
                <Download className="w-4 h-4" />
                Students CSV
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setExcelModalOpen(true)}
                disabled={students.length === 0}
                data-testid="button-export-students-excel"
              >
                <FileSpreadsheet className="w-4 h-4" /> Students Excel
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={async () => {
                  try {
                    const resp = await fetch('/api/export/transactions');
                    if (!resp.ok) throw new Error('Failed');
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `transactions-export-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                  } catch (e:any) {
                    toast({ title: 'Export error', description: e.message, variant: 'destructive' });
                  }
                }}
                data-testid="button-export-transactions"
              >
                <Download className="w-4 h-4" />
                Transactions CSV
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={async () => {
                  try {
                    const resp = await fetch('/api/export/grades');
                    if (!resp.ok) throw new Error('Failed');
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `grades-export-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                  } catch (e:any) {
                    toast({ title: 'Export error', description: e.message, variant: 'destructive' });
                  }
                }}
                data-testid="button-export-grades"
              >
                <Download className="w-4 h-4" />
                Grades CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <StudentsExcelExportModal open={excelModalOpen} onClose={() => setExcelModalOpen(false)} />
    </div>
  );
}
