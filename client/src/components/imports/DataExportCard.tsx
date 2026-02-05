import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@shared/schema";
import { formatCsvDate } from "@/lib/import-parsers";

interface DataExportCardProps {
    students: Student[];
    onOpenExcelExport: () => void;
}

export function DataExportCard({ students, onOpenExcelExport }: DataExportCardProps) {
    const { toast } = useToast();

    const handleExportRTEStudents = () => {
        const rteStudents = students.filter(s => (s as any).isRTE);
        if (rteStudents.length === 0) {
            toast({ title: "No RTE Students", description: "No students marked as RTE found.", variant: "default" });
            return;
        }

        const csvContent = [
            ['admissionNumber', 'name', 'fatherName', 'motherName', 'dateOfBirth', 'admissionDate', 'aadharNumber', 'penNumber', 'aaparId', 'mobileNumber', 'address', 'class', 'section', 'yearlyFeeAmount', 'transportFee', 'previousYearDue', 'category', 'gender', 'session', 'isRTE'].join(','),
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
                '0', // RTE implies 0 tuition fee
                (s as any).transportFee || '0', // Include Transport Fee
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
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>Export student records to Excel or CSV formats.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
                <Button onClick={onOpenExcelExport} className="bg-green-600 hover:bg-green-700">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Students (Excel)
                </Button>
                <Button variant="outline" onClick={handleExportRTEStudents}>
                    <Download className="mr-2 h-4 w-4" /> Export RTE Students (CSV)
                </Button>
            </CardContent>
        </Card>
    );
}
