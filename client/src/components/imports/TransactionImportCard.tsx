import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@shared/schema";
import { normalize, normalizeNumberString, formatCsvDate } from "@/lib/import-parsers";
import { getAuthHeaders } from "@/lib/auth";

interface TransactionImportCardProps {
    students: Student[];
    onImportTransactions?: (transactions: any[]) => Promise<any> | any;
    onImportComplete?: (summary: any, imported: any[], skipped: any[]) => void;
}

export function TransactionImportCard({ students, onImportTransactions, onImportComplete }: TransactionImportCardProps) {
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

                    if (imported.length === 0) {
                        toast({ title: "Import Failed", description: "No valid transaction rows found.", variant: "destructive" });
                        setIsImporting(false);
                        return;
                    }

                    try {
                        let summary: any = null;
                        const payload = imported.map((r: any) => ({
                            studentId: r.studentId,
                            amount: r.amount,
                            paymentDate: r.paymentDate,
                            paymentMode: r.paymentMode,
                            remarks: r.remarks
                        }));

                        if (typeof onImportTransactions === 'function') {
                            summary = await onImportTransactions(payload);
                        } else {
                            const res = await fetch('/api/fees/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                                body: JSON.stringify(payload)
                            });
                            if (!res.ok) throw new Error('Import failed');
                            summary = await res.json();
                        }

                        toast({ title: 'Import Finished', description: `Inserted ${summary.inserted || 0} transactions, skipped ${summary.skipped || 0}` });

                        if (onImportComplete) {
                            onImportComplete(summary, imported, summary.skippedRows || []);
                        }

                    } catch (err: any) {
                        toast({ title: 'Import error', description: err?.message || 'Failed to import transactions', variant: 'destructive' });
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
                <CardTitle className="text-lg">Import Transactions</CardTitle>
                <CardDescription>
                    CSV with columns: Student ID (or Admission Number), Amount, Payment Date.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="trans-csv">Transactions CSV File</Label>
                        <Input
                            id="trans-csv"
                            type="file"
                            accept=".csv"
                            ref={fileRef}
                            onChange={handleFileChange}
                            disabled={isImporting}
                        />
                    </div>
                    <Button disabled={isImporting} className="mb-0.5">
                        {isImporting ? "Importing..." : <><Upload className="mr-2 h-4 w-4" /> Import Transactions</>}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
