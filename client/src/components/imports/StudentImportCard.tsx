import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@shared/schema";
import type { ImportSummary, RawStudentRow } from "@/types";
import { normalize, normalizeDate, normalizeNumberString, transformHeader } from "@/lib/import-parsers";

interface StudentImportCardProps {
    onImportStudents: (students: Omit<Student, 'id'>[], targetSessionId?: string) => Promise<ImportSummary> | ImportSummary;
    importSessionId: string;
    setImportSessionId: (id: string) => void;
    sessions: { id: string; name: string }[];
    onImportComplete?: (summary: ImportSummary, validStudents: RawStudentRow[], invalidRows: any[]) => void;
    students: Student[]; // Required for template generation
}

export function StudentImportCard({ onImportStudents, importSessionId, setImportSessionId, sessions, onImportComplete, students }: StudentImportCardProps) {
    const [isImporting, setIsImporting] = useState(false);
    const [templateGrade, setTemplateGrade] = useState<string>("all");
    const fileRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const uniqueGrades = Array.from(new Set(students.map(s => s.grade)))
        .sort((a, b) => parseInt(a) - parseInt(b));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = (event) => {
            const csv = event.target?.result as string;
            window.Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                transformHeader: transformHeader,
                complete: async (results: any) => {
                    console.log('CSV Parsed Results:', results);

                    const validStudents: RawStudentRow[] = [];
                    const invalidRows: any[] = [];

                    results.data.forEach((row: any, index: number) => {
                        const admVal = row.admissionnumber || row['admission number'] || row.admissionno || row['admission no'] || row.admissionNumber || row['Admission Number'];
                        const nameVal = row.name || row['Name'];

                        if (!admVal || !nameVal) {
                            invalidRows.push({ ...row, _error: 'Missing admission number or name', _index: index });
                            return;
                        }

                        validStudents.push({
                            admissionNumber: normalize(admVal),
                            name: normalize(nameVal),
                            dateOfBirth: normalizeDate(row.dateofbirth || row['date of birth'] || row['dob'] || row.dateOfBirth),
                            admissionDate: normalizeDate(row.admissiondate || row['admission date'] || row.admissionDate),
                            aadharNumber: normalize(row.aadharnumber || row['aadhar number'] || row.aadhar || row.aadharNumber),
                            penNumber: normalize(row.pennumber || row['pen number'] || row.pen || row.penNumber),
                            aaparId: normalize(row.aaparid || row['aapar id'] || row.aapar || row.aaparId),
                            mobileNumber: normalize(row.mobilenumber || row.mobile || row.phone || row.mobileNumber),
                            address: normalize(row.address),
                            grade: normalize(row.grade || row.class || row['Class']),
                            section: normalize(row.section),
                            fatherName: normalize(row.fathername || row["father's name"] || row['father name'] || row.father || row.fatherName),
                            motherName: normalize(row.mothername || row["mother's name"] || row['mother name'] || row.mother || row.motherName),
                            yearlyFeeAmount: normalizeNumberString(row.yearlyfeeamount ?? row['yearly fees'] ?? row.yearlyfee ?? row.yearly_fee_amount ?? row.yearlyFeeAmount),
                            previousYearDue: normalizeNumberString(row.previousyeardue ?? row['previous year due'] ?? row['previous due'] ?? row.previousyeardue ?? row.previousYearDue),
                            category: normalize(row.category || 'GEN'),
                            gender: normalize(row.gender || ''),
                            isRTE: normalize(row.isrte || row.isRTE || row.is_rte || row['RTE'] || row['rte'])
                        });
                    });

                    if (validStudents.length === 0 && invalidRows.length > 0) {
                        toast({
                            title: "Import Failed",
                            description: `No valid rows found. ${invalidRows.length} rows failed validation.`,
                            variant: "destructive"
                        });
                        setIsImporting(false);
                        if (onImportComplete) onImportComplete({ added: 0, skipped: 0 }, [], invalidRows);
                        return;
                    }

                    try {
                        const summary = await onImportStudents(validStudents, importSessionId);
                        let msg = `Added ${summary.added} students, skipped ${summary.skipped} duplicates`;
                        if (invalidRows.length > 0) msg += `. ${invalidRows.length} rows were invalid.`;

                        toast({
                            title: "Import Finished",
                            description: msg,
                        });

                        if (onImportComplete) onImportComplete(summary, validStudents, invalidRows);

                    } catch (err: any) {
                        toast({ title: "Import Error", description: err.message, variant: "destructive" });
                    } finally {
                        setIsImporting(false);
                        if (fileRef.current) fileRef.current.value = '';
                    }
                }
            });
        };
        reader.readAsText(file);
    };

    const handleDownloadTemplate = () => {
        const filtered = templateGrade === 'all' ? students : students.filter(s => s.grade === templateGrade);
        const header = ['admissionNumber', 'name', 'fatherName', 'motherName', 'dateOfBirth', 'gender', 'admissionDate', 'aadharNumber', 'penNumber', 'aaparId', 'mobileNumber', 'address', 'class', 'section', 'yearlyFeeAmount', 'transportFee', 'previousYearDue', 'category', 'session', 'isRTE'];
        const sample = [
            'STU001', 'Sample Student', 'Sample Father', 'Sample Mother', '2010-05-14', 'Male', '2022-03-31', '1234-5678-9012', 'PEN000001', 'AAP001', '555-0100', '123 Sample Street', '10', 'A', '25000', '2000', '5000', 'GEN', '2025-26', 'No'
        ].join(',');
        const csv = [header.join(','), sample].join('\n');
        const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `students-template-class-${templateGrade}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Import Students</CardTitle>
                <CardDescription>
                    Upload a CSV file containing student details.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="template-grade">Template Class</Label>
                    <div className="flex gap-2">
                        <Select value={templateGrade} onValueChange={setTemplateGrade}>
                            <SelectTrigger id="template-grade" className="w-[180px]">
                                <SelectValue placeholder="All classes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All classes</SelectItem>
                                {uniqueGrades.map(g => (
                                    <SelectItem key={g} value={g}>Class {g}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" onClick={handleDownloadTemplate} size="sm">
                            <Download className="w-4 h-4 mr-2" /> Template
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="import-session">Target Session</Label>
                    <Select value={importSessionId} onValueChange={setImportSessionId}>
                        <SelectTrigger id="import-session">
                            <SelectValue placeholder="Use default" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default">Use default / from file</SelectItem>
                            {sessions.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Students without a specific session in CSV will be added here.</p>
                </div>

                <div className="flex items-end gap-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="student-csv">CSV File</Label>
                        <Input
                            id="student-csv"
                            type="file"
                            accept=".csv"
                            ref={fileRef}
                            onChange={handleFileChange}
                            disabled={isImporting}
                        />
                    </div>
                    <Button disabled={isImporting} className="mb-0.5">
                        {isImporting ? "Importing..." : <><Upload className="mr-2 h-4 w-4" /> Import</>}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
