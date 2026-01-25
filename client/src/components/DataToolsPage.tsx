import { useState, useRef, useEffect } from "react";
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
import { getAuthHeaders } from "@/lib/auth";

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
  category?: string;
  gender?: string;
  previousYearDue?: string;
  isRTE?: string;
};

interface DataToolsPageProps {
  students: Student[];
  // returns a summary of import (added/skipped)
  onImportStudents: (students: Omit<Student, 'id'>[], targetSessionId?: string) => Promise<ImportSummary> | ImportSummary;
  // upsert existing students (update existing records by admissionNumber)
  onUpsertStudents: (students: Omit<Student, 'id'>[]) => Promise<{ updated: number }> | { updated: number };
  onImportGrades: (grades: GradeEntry[]) => Promise<void> | void;
  onImportTransactions?: (transactions: { studentId: string; amount: string; paymentDate: string; paymentMode?: string; remarks?: string }[]) => Promise<{ inserted: number; skipped: number; skippedRows?: any[] }> | { inserted: number; skipped: number; skippedRows?: any[] };
  sessions: { id: string; name: string }[];
  selectedSessionId?: string;
}

declare global {
  interface Window {
    Papa: any;
  }
}

export default function DataToolsPage({ students, onImportStudents, onUpsertStudents, onImportGrades, onImportTransactions, sessions, selectedSessionId }: DataToolsPageProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [exportFilter, setExportFilter] = useState<string>("all");
  const [templateGrade, setTemplateGrade] = useState<string>("all");
  const [importSessionId, setImportSessionId] = useState<string>(selectedSessionId || "");
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

  // Backup & Restore State
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  // Sync importSessionId with selectedSessionId prop
  useEffect(() => {
    if (selectedSessionId) {
      setImportSessionId(selectedSessionId);
    }
  }, [selectedSessionId]);

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
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim().toLowerCase(), // Normalize headers to lowercase
        complete: async (results: any) => {
          console.log('CSV Parsed Results:', results);
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


          const validStudents: any[] = [];
          const invalidRows: any[] = [];

          results.data.forEach((row: any, index: number) => {
            // Helper to safe get (case insensitive check fallback if transformHeader fails)
            const getField = (keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
              }
              // manual scan if needed (e.g. whitespace) or just return undefined
              return undefined;
            };

            // adjusted to lower case keys since we use transformHeader, but keeping original casing as fallback just in case
            const admVal = row.admissionnumber || row['admission number'] || row.admissionno || row['admission no'] || row.admissionNumber || row['Admission Number'];
            const nameVal = row.name || row['Name'];

            if (!admVal || !nameVal) {
              invalidRows.push({ ...row, _error: 'Missing admission number or name', _index: index });
              return;
            }

            const admissionNumber = normalize(admVal);
            const name = normalize(nameVal);
            const dateOfBirth = normalizeDate(row.dateofbirth || row['date of birth'] || row['dob'] || row.dateOfBirth);
            const admissionDate = normalizeDate(row.admissiondate || row['admission date'] || row.admissionDate);
            const aadharNumber = normalize(row.aadharnumber || row['aadhar number'] || row.aadhar || row.aadharNumber);
            const penNumber = normalize(row.pennumber || row['pen number'] || row.pen || row.penNumber);
            const aaparId = normalize(row.aaparid || row['aapar id'] || row.aapar || row.aaparId);
            const mobileNumber = normalize(row.mobilenumber || row.mobile || row.phone || row.mobileNumber);
            const address = normalize(row.address);
            const grade = normalize(row.grade || row.class || row['Class']);
            const section = normalize(row.section);
            const yfaRaw = row.yearlyfeeamount ?? row['yearly fees'] ?? row.yearlyfee ?? row.yearly_fee_amount ?? row.yearlyFeeAmount;
            const yearlyFeeAmount = yfaRaw === undefined || yfaRaw === null ? '' : normalizeNumberString(yfaRaw);
            const pydRaw = row.previousyeardue ?? row['previous year due'] ?? row['previous due'] ?? row.previousyeardue ?? row.previousYearDue;
            const previousYearDue = pydRaw === undefined || pydRaw === null ? '' : normalizeNumberString(pydRaw);
            const tfRaw = row.transportfee ?? row['transport fee'] ?? row['transport fees'] ?? row.transport_fee ?? row.transportFee;
            const transportFee = tfRaw === undefined || tfRaw === null ? '' : normalizeNumberString(tfRaw);
            const fatherName = normalize(row.fathername || row["father's name"] || row['father name'] || row.father || row.fatherName);
            const motherName = normalize(row.mothername || row["mother's name"] || row['mother name'] || row.mother || row.motherName);
            const category = normalize(row.category || 'GEN');
            const gender = normalize(row.gender || '');
            const isRTE = normalize(row.isRTE || row.is_rte || row['RTE'] || row['rte']);

            validStudents.push({
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
              previousYearDue,
              transportFee,
              category,
              gender,
              isRTE
            });
          });

          console.log('Valid Students:', validStudents.length, 'Invalid Rows:', invalidRows.length);
          if (validStudents.length === 0 && invalidRows.length > 0) {
            toast({
              title: "Import Failed",
              description: `No valid rows found. ${invalidRows.length} rows failed validation (missing admission number or name). check console or skipped list.`,
              variant: "destructive"
            });
            // Show invalid rows as skipped
            setSkippedAdmissions(invalidRows.map(r => `Row ${r._index}: ${r._error}`));
            setLastImportedRows(invalidRows); // for debug view
            setIsImporting(false);
            return;
          }

          setLastImportedRows(validStudents as RawStudentRow[]);

          if (validStudents.length > 0) {
            const summary = await onImportStudents(validStudents, importSessionId);
            let msg = `Added ${summary.added} students, skipped ${summary.skipped} duplicates`;
            if (invalidRows.length > 0) {
              msg += `. ${invalidRows.length} rows were invalid.`;
            }
            toast({
              title: "Import Finished",
              description: msg,
            });

            const allSkipped = [
              ...(summary.skippedAdmissionNumbers || []),
              ...invalidRows.map(r => `[Invalid] Row ${r._index}: ${JSON.stringify(r)}`)
            ];

            if (allSkipped.length > 0) {
              setSkippedAdmissions(allSkipped);
              // merge invalid rows into skippedRows for export if needed (rough approximation)
              setSkippedRows([...(invalidRows as any), ...(validStudents.filter(s => summary.skippedAdmissionNumbers?.includes(s.admissionNumber)))]);
            }
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
            .map((row: any) => {
              const admissionNumber = (row.admissionNumber || row['Admission Number'] || '').trim();
              const studentId = (row.studentId || row['Student ID'] || '').trim() || (admissionNumber ? (students.find(s => s.admissionNumber === admissionNumber)?.id || '') : '');
              return {
                studentId,
                subject: (row.subject || row['Subject'] || '').trim(),
                marks: parseFloat(row.marks || row['Marks'] || '0'),
                term: (row.term || row['Term'] || '').trim()
              };
            })
            .filter((row: any) => row.studentId && row.subject && !isNaN(row.marks) && row.term);

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


  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup/export', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to download backup");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `school_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Backup Downloaded", description: "Your school data has been saved." });
    } catch (e: any) {
      toast({ title: "Backup Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupFile) return;
    setIsRestoring(true);
    try {
      const text = await backupFile.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(json)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Restore failed");
      }

      const data = await res.json();
      toast({ title: "Restore Successful", description: "System data has been restored." });
      setRestoreDialogOpen(false);
      setBackupFile(null);
      // Optional: Refresh page to show new data
      setTimeout(() => window.location.reload(), 1500);

    } catch (e: any) {
      toast({ title: "Restore Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportStudents = () => {
    // Filter students based on selected filter
    const filteredStudents = exportFilter === "all"
      ? students
      : students.filter(s => s.grade === exportFilter);

    const csvContent = [
      ['admissionNumber', 'name', 'fatherName', 'motherName', 'dateOfBirth', 'admissionDate', 'aadharNumber', 'penNumber', 'aaparId', 'mobileNumber', 'address', 'class', 'section', 'yearlyFeeAmount', 'previousYearDue', 'category', 'gender', 'session'].join(','),
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
        s.section,
        (s as any).yearlyFeeAmount || '',
        (s as any).previousYearDue || '0',
        (s as any).category || 'GEN',
        (s as any).gender || '',
        (s as any).transportFee || '',
        (s as any).sessionName || '' // We might need to fetch this or it might be on the student object if joined
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

  const handleExportRTEStudents = () => {
    const rteStudents = students.filter(s => (s as any).isRTE);
    if (rteStudents.length === 0) {
      toast({ title: "No RTE Students", description: "No students marked as RTE found.", variant: "default" });
      return;
    }

    const csvContent = [
      ['admissionNumber', 'name', 'fatherName', 'motherName', 'dateOfBirth', 'admissionDate', 'aadharNumber', 'penNumber', 'aaparId', 'mobileNumber', 'address', 'class', 'section', 'yearlyFeeAmount', 'previousYearDue', 'category', 'gender', 'session', 'isRTE'].join(','),
      ...rteStudents.map(s => [
        s.admissionNumber,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.fatherName || '').replace(/"/g, '""')}"`,
        `"${(s.motherName || '').replace(/"/g, '""')}"`,
        formatCsvDate(s.dateOfBirth),
        formatCsvDate(s.admissionDate),
        s.aadharNumber,
        s.penNumber,
        s.aaparId,
        s.mobileNumber,
        `"${(s.address || '').replace(/"/g, '""')}"`,
        s.grade,
        s.section,
        '0', // RTE implies 0 fee
        (s as any).previousYearDue || '0',
        (s as any).category || 'GEN',
        (s as any).gender || '',
        (s as any).sessionName || '',
        'Yes'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rte-students-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        {/* Demo data loader for admins/testing. Shown when parent provides handler. */}

      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Data Tools</h1>
        <p className="text-muted-foreground">Import and export data in bulk</p>
      </div>

      {/* Skipped duplicates/errors dialog */}
      <AlertDialog open={!!skippedAdmissions} onOpenChange={() => setSkippedAdmissions(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Report: Skipped Records</AlertDialogTitle>
            <AlertDialogDescription>
              The following records were skipped due to errors (duplicates or missing required fields).
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
              <p className="font-mono text-xs">admissionNumber, name, fatherName or "Father's Name", motherName or "Mother's Name", dateOfBirth, admissionDate, aadharNumber, penNumber, aaparId, mobileNumber, address, grade or class, section, yearlyFeeAmount or "Yearly fees", previousYearDue, category, gender, session or "Session Name"</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-session">Target Session (optional)</Label>
              <Select value={importSessionId} onValueChange={setImportSessionId}>
                <SelectTrigger id="import-session">
                  <SelectValue placeholder="Use default / from file" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Use default / from file</SelectItem>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">If selected, students without a 'Session' column in CSV will be added to this session.</p>
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
                  const header = ['admissionNumber', 'name', 'fatherName', 'motherName', 'dateOfBirth', 'gender', 'admissionDate', 'aadharNumber', 'penNumber', 'aaparId', 'mobileNumber', 'address', 'class', 'section', 'yearlyFeeAmount', 'transportFee', 'previousYearDue', 'category', 'session', 'isRTE'];
                  // Template with one sample row illustrating date format (YYYY-MM-DD)
                  const sample = [
                    'STU001',
                    'Sample Student',
                    'Sample Father Name',
                    'Sample Mother Name',
                    '2010-05-14', // dateOfBirth (YYYY-MM-DD)
                    'Male',       // gender
                    '2022-03-31', // admissionDate (YYYY-MM-DD)
                    '1234-5678-9012',
                    'PEN000001',
                    'AAP001',
                    '555-0100',
                    '123 Sample Street',
                    '10',
                    'A',
                    '25000',
                    '2000', // transportFee
                    '5000',
                    'GEN',
                    '2025-26',
                    'No' // isRTE
                  ].join(',');
                  const csv = [header.join(','), sample].join('\n');

                  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const safeGrade = (templateGrade === 'all' ? 'all' : 'class-' + templateGrade).replace(/[^a-z0-9\-_]/gi, '_');
                  a.download = `students-template-${safeGrade}.csv`;
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
              <p className="font-mono text-xs">admissionNumber (or studentId), subject, marks, term</p>
            </div>
            <div className="flex gap-2">
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
              <Button
                variant="ghost"
                className="w-full gap-2"
                onClick={() => {
                  const header = ['admissionNumber', 'subject', 'marks', 'term'];
                  const sample = ['STU001', 'Mathematics', '85.5', 'Term 1'].join(',');
                  const csv = [header.join(','), sample].join('\n');

                  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `grades-template.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                data-testid="button-download-grades-template"
              >
                <Download className="w-4 h-4" />
                Download Template
              </Button>
            </div>
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
            <div className="flex gap-2">
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
              <Button
                variant="ghost"
                className="w-full gap-2"
                onClick={() => {
                  const header = ['admissionNumber', 'amount', 'paymentDate', 'paymentMode', 'remarks'];
                  const sample = ['STU001', '5000', '2025-04-01', 'cash', 'Term 1 Fee'].join(',');
                  const csv = [header.join(','), sample].join('\n');

                  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `transactions-template.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                data-testid="button-download-transactions-template"
              >
                <Download className="w-4 h-4" />
                Download Template
              </Button>
            </div>
          </CardContent>

        </Card>

        <Card className="border-red-200 dark:border-red-900 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-red-600">⚠</span> System Backup & Restore
            </CardTitle>
            <CardDescription>
              Create a full snapshot of your school's data or restore from a previous backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button onClick={handleDownloadBackup} className="w-full gap-2">
                <Download className="w-4 h-4" /> Download Full Backup
              </Button>
              <p className="text-xs text-muted-foreground">
                Downloads a JSON file containing all students, fees, grades, and settings.
              </p>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label>Restore from Backup</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".json"
                  ref={restoreFileRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setBackupFile(e.target.files[0]);
                      setRestoreDialogOpen(true);
                      // Reset input so same file selection triggers change again if needed
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              <p className="text-xs text-red-500 font-medium">
                Warning: Restoring will REPLACE all current data.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">Unknown Danger: Data Overwrite</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to restore a backup from <strong>{backupFile?.name}</strong>.
                <br /><br />
                <span className="font-bold text-red-600">WARNING:</span> This action is destructive.
                All current students, fee records, and grades will be <strong>PERMANENTLY DELETED</strong> and replaced by the backup data.
                <br /><br />
                Are you absolutely sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBackupFile(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestoreBackup}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={isRestoring}
              >
                {isRestoring ? 'Restoring...' : 'Yes, Overwrite Everything'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                className="w-full gap-2 border-dashed border-primary/50 hover:bg-primary/5"
                onClick={handleExportRTEStudents}
                data-testid="button-export-rte-students"
              >
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Download RTE List
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={async () => {
                  try {
                    const resp = await fetch('/api/export/transactions', { headers: getAuthHeaders() });
                    if (!resp.ok) throw new Error('Failed');
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `transactions-export-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                  } catch (e: any) {
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
                    const resp = await fetch('/api/export/grades', { headers: getAuthHeaders() });
                    if (!resp.ok) throw new Error('Failed');
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `grades-export-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                  } catch (e: any) {
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
    </div >
  );
}
