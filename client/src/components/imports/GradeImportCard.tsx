import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@shared/schema";
import type { GradeEntry } from "@/types";

interface GradeImportCardProps {
    students: Student[];
    onImportGrades: (grades: GradeEntry[]) => Promise<void> | void;
}

export function GradeImportCard({ students, onImportGrades }: GradeImportCardProps) {
    const [isImporting, setIsImporting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = (event) => {
            const csv = event.target?.result as string;
            window.Papa.parse(csv, {
                header: true,
                complete: async (results: any) => {
                    const importedGrades: GradeEntry[] = results.data
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

                    if (importedGrades.length === 0) {
                        toast({ title: "Import Failed", description: "No valid grade rows found.", variant: "destructive" });
                        setIsImporting(false);
                        return;
                    }

                    try {
                        await onImportGrades(importedGrades);
                        toast({
                            title: "Import Successful",
                            description: `Imported ${importedGrades.length} grade entries`,
                        });
                    } catch (error) {
                        console.error(error);
                        toast({ title: "Import Error", description: "Failed to import grades", variant: "destructive" });
                    } finally {
                        setIsImporting(false);
                        if (fileRef.current) fileRef.current.value = '';
                    }
                }
            });
        };
        reader.readAsText(file);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Import Grades</CardTitle>
                <CardDescription>
                    CSV with columns: Admission Number (or Student ID), Subject, Marks, Term.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="grade-csv">Grades CSV File</Label>
                        <Input
                            id="grade-csv"
                            type="file"
                            accept=".csv"
                            ref={fileRef}
                            onChange={handleFileChange}
                            disabled={isImporting}
                        />
                    </div>
                    <Button disabled={isImporting} className="mb-0.5">
                        {isImporting ? "Importing..." : <><Upload className="mr-2 h-4 w-4" /> Import Grades</>}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
