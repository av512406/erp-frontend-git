import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, Column } from "@/components/ui/data-table";
import { Download, MessageSquare } from "lucide-react";
import { usePendingFees } from "@/hooks/use-pending-fees";
import { useToast } from "@/hooks/use-toast";
import { formatClass } from "@/lib/utils";
import type { Student, FeeTransaction } from "@/types";

interface PendingFeesTabProps {
    students: Student[];
    transactions: FeeTransaction[];
    schoolName: string;
    smsEnabled: boolean;
}

export default function PendingFeesTab({ students, transactions, schoolName, smsEnabled }: PendingFeesTabProps) {
    const { toast } = useToast();
    const {
        filteredPendingStudents,
        uniquePendingClasses,
        uniquePendingSections,
        pendingFilterClass,
        setPendingFilterClass,
        pendingFilterSection,
        setPendingFilterSection
    } = usePendingFees(students, transactions);

    const handleExportPendingExcel = async () => {
        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Pending Fees');

            worksheet.columns = [
                { header: 'Admission No', key: 'admissionNumber', width: 15 },
                { header: 'Name', key: 'name', width: 20 },
                { header: 'Father Name', key: 'fatherName', width: 20 },
                { header: 'Class', key: 'grade', width: 10 },
                { header: 'Section', key: 'section', width: 10 },
                { header: 'Phone', key: 'phone', width: 15 },
                { header: 'Yearly Fee', key: 'yearly', width: 15 },
                { header: 'Transport Fee', key: 'transport', width: 15 },
                { header: 'Prev. Due', key: 'previousDue', width: 15 },
                { header: 'Total Paid', key: 'paid', width: 15 },
                { header: 'Pending Amount', key: 'pending', width: 15 },
            ];

            filteredPendingStudents.forEach(s => {
                worksheet.addRow({
                    admissionNumber: s.admissionNumber,
                    name: s.name,
                    fatherName: s.fatherName || '',
                    grade: s.grade,
                    section: s.section,
                    phone: (s as any).phone || '',
                    yearly: s.yearly,
                    transport: (s as any).transportFee || 0,
                    previousDue: s.previousDue,
                    paid: s.paid,
                    pending: s.pending
                });
            });

            worksheet.getRow(1).font = { bold: true };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pending-fees-${pendingFilterClass}-${pendingFilterSection}-${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            toast({ title: "Export failed", description: "Could not generate Excel file", variant: "destructive" });
        }
    };

    const pendingColumns: Column<any>[] = [
        { header: "Admission No", accessorKey: "admissionNumber", className: "font-mono", sortable: true },
        { header: "Name", accessorKey: "name", className: "font-medium", sortable: true },
        { header: "Father Name", accessorKey: "fatherName", sortable: true },
        { header: "Class", accessorKey: "grade", sortable: true },
        { header: "Section", accessorKey: "section", sortable: true },
        { header: 'Yearly Fee', accessorKey: "yearly", cell: (s) => `₹${s.yearly.toLocaleString('en-IN')}`, sortable: true },
        { header: 'Transport', accessorKey: "transportFee", cell: (s) => `₹${((s as any).transportFee || 0).toLocaleString('en-IN')}`, sortable: true },
        { header: "Prev. Due", accessorKey: "previousDue", cell: (s) => `₹${s.previousDue.toLocaleString('en-IN')}`, sortable: true },
        { header: "Total Paid", accessorKey: "paid", cell: (s) => `₹${s.paid.toLocaleString('en-IN')}`, sortable: true },
        { header: "Pending Amount", accessorKey: "pending", cell: (s) => `₹${s.pending.toLocaleString('en-IN')}`, className: "font-bold text-red-600", sortable: true },
        {
            header: "Action",
            cell: (row) => smsEnabled && (row as any).mobileNumber ? (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2"
                    onClick={() => {
                        const message = `Dear Parent,\n\nPending fee for ${(row as any).name} is Rs. ${(row as any).pending}. Please pay at the earliest.\n\nRegards,\nPrincipal\n${schoolName}`;
                        window.open(`sms:${(row as any).mobileNumber}?body=${encodeURIComponent(message)}`, '_blank');
                    }}
                >
                    <MessageSquare className="h-4 w-4" /> SMS
                </Button>
            ) : null
        }
    ];

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <CardTitle>Pending Fees List</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={handleExportPendingExcel}
                        >
                            <Download className="w-4 h-4" />
                            Export Excel
                        </Button>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-40">
                            <Label htmlFor="pending-class" className="text-xs mb-1 block">Class</Label>
                            <Select value={pendingFilterClass} onValueChange={setPendingFilterClass}>
                                <SelectTrigger id="pending-class" className="h-8">
                                    <SelectValue placeholder="All Classes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Classes</SelectItem>
                                    {uniquePendingClasses.map(c => (
                                        <SelectItem key={c} value={c}>{formatClass(c)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-40">
                            <Label htmlFor="pending-section" className="text-xs mb-1 block">Section</Label>
                            <Select value={pendingFilterSection} onValueChange={setPendingFilterSection}>
                                <SelectTrigger id="pending-section" className="h-8">
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {uniquePendingSections.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg p-4">
                    <DataTable columns={pendingColumns} data={filteredPendingStudents} />
                </div>
            </CardContent>
        </Card>
    );
}
