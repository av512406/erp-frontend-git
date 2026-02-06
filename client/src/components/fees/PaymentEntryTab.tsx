import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, Column } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import ReceiptDistributionModal from '../ReceiptDistributionModal';
import { useFeeMutations } from "@/hooks/use-fee-mutations";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { sortGrades, formatClass } from "@/lib/utils";
import type { Student, FeeTransaction } from '@/types';

interface PaymentEntryTabProps {
    students: Student[];
    transactions: FeeTransaction[];
    selectedSessionId: string;
    sessionName: string;
    userRole?: string;
    filterDate: string | null;
    setFilterDate: (date: string | null) => void;
}

export default function PaymentEntryTab({ students, transactions, selectedSessionId, sessionName, userRole, filterDate, setFilterDate }: PaymentEntryTabProps) {
    const { toast } = useToast();
    const { addTransaction, cancelTransaction } = useFeeMutations();

    const [viewStudent, setViewStudent] = useState("all");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    const [paymentMode, setPaymentMode] = useState<string>('cash');
    const [remarks, setRemarks] = useState<string>('');
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [distributionTx, setDistributionTx] = useState<FeeTransaction | null>(null);

    const [filterGrade, setFilterGrade] = useState<'all' | string>('all');
    const [filterSection, setFilterSection] = useState<'all' | string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const [exportStart, setExportStart] = useState<string>('');
    const [exportEnd, setExportEnd] = useState<string>('');
    const [exporting, setExporting] = useState(false);

    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [transactionToCancel, setTransactionToCancel] = useState<FeeTransaction | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [isCancelling, setIsCancelling] = useState(false);

    const [availableGrades, setAvailableGrades] = useState<string[]>([]);
    const [availableSections, setAvailableSections] = useState<string[]>([]);

    useEffect(() => {
        fetch('/api/classes/grades', { headers: getAuthHeaders() })
            .then(res => res.ok ? res.json() : [])
            .then(data => setAvailableGrades(sortGrades(data)))
            .catch(() => setAvailableGrades([]));
    }, []);

    useEffect(() => {
        setAvailableSections([]);
        if (!filterGrade || filterGrade === 'all') return;

        fetch(`/api/classes/${encodeURIComponent(filterGrade)}/sections`, { headers: getAuthHeaders() })
            .then(res => res.ok ? res.json() : [])
            .then(data => setAvailableSections(data.sort()))
            .catch(() => setAvailableSections([]));
    }, [filterGrade]);

    useEffect(() => {
        if (filterSection !== 'all' && availableSections.length > 0 && !availableSections.includes(filterSection)) {
            setFilterSection('all');
        }
    }, [filterGrade, availableSections, filterSection]);

    const filteredStudents = useMemo(() => {
        if (searchTerm) {
            return students.filter(s =>
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return students.filter(s => {
            const gradeOk = filterGrade === 'all' || s.grade === filterGrade;
            const sectionOk = filterSection === 'all' || s.section === filterSection;
            return gradeOk && sectionOk;
        });
    }, [students, filterGrade, filterSection, searchTerm]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const student = students.find(s => s.id === viewStudent);
        if (student) {
            try {
                setSubmitError(null);
                const raw = amount.trim();
                if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
                    setSubmitError('Enter a valid amount (up to 2 decimals)');
                    return;
                }

                const created = await addTransaction.mutateAsync({
                    transaction: {
                        studentId: student.id,
                        studentName: student.name,
                        amount: Number(raw),
                        date,
                        paymentMode,
                        remarks
                    },
                    sessionId: selectedSessionId
                });

                setDistributionTx(created);
                setAmount("");

                const now = new Date();
                setDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
                setPaymentMode('cash');
                setRemarks('');
                toast({ title: "Payment recorded successfully" });
            } catch (err: any) {
                setSubmitError(err?.message || 'Failed to record payment');
            }
        }
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (exportStart) params.set('start', exportStart);
            if (exportEnd) params.set('end', exportEnd);
            const url = `/api/export/transactions/excel?${params.toString()}`;
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;
            document.body.appendChild(iframe);
            setTimeout(() => {
                iframe.remove();
            }, 10000);
        } catch (e) {
            alert('Failed to initiate download');
        } finally {
            setExporting(false);
        }
    };

    const viewedStudent = viewStudent === 'all' ? null : (students.find(s => s.id === viewStudent) || null);
    const studentTransactions = viewStudent === 'all' ? [] : transactions.filter(t => t.studentId === viewStudent);

    const filteredTransactionIds = useMemo(() => new Set(filteredStudents.map(s => s.id)), [filteredStudents]);

    const displayedTransactions = useMemo(() => {
        let txs = viewStudent === 'all'
            ? transactions.filter(t => filteredTransactionIds.has(t.studentId))
            : studentTransactions;

        if (filterDate) {
            txs = txs.filter(t => t.date && t.date.substring(0, 10) === filterDate);
        }
        return txs;
    }, [viewStudent, transactions, filteredTransactionIds, studentTransactions, filterDate]);

    const totalPaid = studentTransactions
        .filter(t => t.status !== 'cancelled')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    const yearlyFee = viewedStudent ? parseFloat((viewedStudent as any).yearlyFeeAmount || '0') : 0;
    const previousDue = viewedStudent ? parseFloat((viewedStudent as any).previousYearDue || '0') : 0;
    const transportFee = viewedStudent ? parseFloat((viewedStudent as any).transportFee || '0') : 0;
    const balance = (yearlyFee + previousDue + transportFee) - totalPaid;

    const historyColumns: Column<FeeTransaction>[] = [
        { header: "Receipt Serial", accessorKey: "receiptSerial", cell: (t) => t.receiptSerial != null ? String(t.receiptSerial).padStart(4, '0') : '—', className: "font-mono text-sm", sortable: true },
        { header: "Transaction ID", accessorKey: "transactionId", className: "font-mono text-sm", sortable: true },
        { header: "Student Name", accessorKey: "studentName", className: "font-medium", sortable: true },
        { header: "Amount", accessorKey: "amount", cell: (t) => `₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, className: "font-semibold", sortable: true },
        { header: "Date", accessorKey: "date", cell: (t) => t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '-', sortable: true },
        { header: "Time", cell: (t) => t.createdAt ? format(new Date(t.createdAt), 'hh:mm a') : '-' },
        {
            header: "Actions", className: "text-right", cell: (t) => (
                <div className="flex justify-end space-x-2">
                    {t.status === 'cancelled' ? (
                        <span className="text-red-500 text-sm font-medium mr-2" title={t.cancelReason}>Cancelled</span>
                    ) : (
                        (userRole === 'admin' || userRole === 'superadmin') && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    setTransactionToCancel(t);
                                    setCancelReason("");
                                    setCancelDialogOpen(true);
                                }}
                            >
                                Cancel
                            </Button>
                        )
                    )}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDistributionTx(t)}
                    >
                        Print Receipt
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Student Details & Payment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {/* Filters Section */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="search-student">Search Student</Label>
                                    <Input
                                        id="search-student"
                                        placeholder="Name or Admission No."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filter-grade">Class</Label>
                                    <Select value={filterGrade} onValueChange={(v) => setFilterGrade(v as any)}>
                                        <SelectTrigger id="filter-grade">
                                            <SelectValue placeholder="All classes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All classes</SelectItem>
                                            {availableGrades.map(g => (
                                                <SelectItem key={g} value={g}>{formatClass(g)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filter-section">Section</Label>
                                    <Select value={filterSection} onValueChange={(v) => setFilterSection(v as any)}>
                                        <SelectTrigger id="filter-section">
                                            <SelectValue placeholder="All sections" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All sections</SelectItem>
                                            {availableSections.map(sec => (
                                                <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="view-student">Student</Label>
                                    <Select value={viewStudent} onValueChange={setViewStudent}>
                                        <SelectTrigger id="view-student">
                                            <SelectValue placeholder="Select a student" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Select a student...</SelectItem>
                                            {filteredStudents.map((student) => (
                                                <SelectItem key={student.id} value={student.id}>
                                                    {student.name} ({student.admissionNumber}) {student.fatherName ? `- S/O ${student.fatherName}` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {viewedStudent && (
                                <div className="border-t pt-6 mt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="mb-6 p-4 border rounded-lg bg-slate-50">
                                                <h3 className="text-lg font-semibold mb-2">{viewedStudent.name}</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">Admission No:</span>
                                                        <span className="ml-2 font-medium">{viewedStudent.admissionNumber}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Father's Name:</span>
                                                        <span className="ml-2 font-medium">{viewedStudent.fatherName || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Class:</span>
                                                        <span className="ml-2 font-medium">{formatClass(viewedStudent.grade, viewedStudent.section)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <h3 className="text-lg font-semibold">Fee Summary</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-muted rounded-lg">
                                                    <p className="text-sm text-muted-foreground">Yearly Fee</p>
                                                    <p className="text-2xl font-bold">₹{yearlyFee.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="p-4 bg-muted rounded-lg">
                                                    <p className="text-sm text-muted-foreground">Previous Due</p>
                                                    <p className="text-2xl font-bold">₹{previousDue.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="p-4 bg-muted rounded-lg">
                                                    <p className="text-sm text-muted-foreground">Total Paid</p>
                                                    <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="p-4 bg-muted rounded-lg">
                                                    <p className="text-sm text-muted-foreground">Transport Fee</p>
                                                    <p className="text-2xl font-bold">₹{transportFee.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="p-4 bg-muted rounded-lg">
                                                    <p className="text-sm text-muted-foreground">Balance Due</p>
                                                    <p className={`text-3xl font-bold ${balance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        ₹{balance.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 border-l pl-8">
                                            <h3 className="text-lg font-semibold">Record New Payment</h3>
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="amount">Amount (₹)</Label>
                                                        <Input
                                                            id="amount"
                                                            type="text"
                                                            inputMode="decimal"
                                                            pattern="\d+(?:\.\d{1,2})?"
                                                            placeholder="0.00"
                                                            value={amount}
                                                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                                            required
                                                            data-testid="input-amount"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="date">Payment Date</Label>
                                                        <Input
                                                            id="date"
                                                            type="date"
                                                            value={date}
                                                            onChange={(e) => setDate(e.target.value)}
                                                            required
                                                            data-testid="input-date"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="payment-mode">Payment Mode</Label>
                                                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                                                        <SelectTrigger id="payment-mode" data-testid="select-payment-mode">
                                                            <SelectValue placeholder="Select payment mode" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="cash">Cash</SelectItem>
                                                            <SelectItem value="card">Card</SelectItem>
                                                            <SelectItem value="upi">UPI</SelectItem>
                                                            <SelectItem value="cheque">Cheque</SelectItem>
                                                            <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                                                            <SelectItem value="other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="remarks">Remarks</Label>
                                                    <Textarea
                                                        id="remarks"
                                                        value={remarks}
                                                        onChange={(e) => setRemarks(e.target.value)}
                                                        placeholder="Optional notes..."
                                                        className="h-20"
                                                        data-testid="input-remarks"
                                                    />
                                                </div>

                                                <Button type="submit" className="w-full" data-testid="button-record-payment">
                                                    Record Payment
                                                </Button>
                                                {submitError && (
                                                    <p className="text-sm text-red-600" role="alert">{submitError}</p>
                                                )}
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <CardTitle>Payment History</CardTitle>
                            <div className="flex items-end gap-2 flex-wrap">
                                <div className="flex flex-col">
                                    <Label htmlFor="export-start" className="text-xs">From</Label>
                                    <Input id="export-start" type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="h-8" />
                                </div>
                                <div className="flex flex-col">
                                    <Label htmlFor="export-end" className="text-xs">To</Label>
                                    <Input id="export-end" type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="h-8" />
                                </div>
                                <Button type="button" variant="outline" size="sm" disabled={exporting} onClick={handleExportExcel} className="gap-2" data-testid="button-export-fees-excel">
                                    <FileText className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export Excel'}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="border rounded-lg p-4">
                            <DataTable columns={historyColumns} data={displayedTransactions} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ReceiptDistributionModal
                open={!!distributionTx}
                onClose={() => setDistributionTx(null)}
                transaction={distributionTx}
                student={distributionTx ? students.find(s => s.id === distributionTx.studentId) || null : null}
                yearlyFeeAmount={distributionTx ? parseFloat(String((students.find(s => s.id === distributionTx.studentId) as any)?.yearlyFeeAmount || '0')) : undefined}
                previousYearDue={distributionTx ? parseFloat(String((students.find(s => s.id === distributionTx.studentId) as any)?.previousYearDue || '0')) : undefined}
                paidSoFar={distributionTx ? (transactions.filter(t => t.studentId === distributionTx.studentId && t.status !== 'cancelled').reduce((sum, t) => sum + (t.amount || 0), 0)) : undefined}
                sessionName={sessionName}
            />

            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Transaction</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this transaction? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="cancel-reason">Reason for Cancellation</Label>
                        <Input
                            id="cancel-reason"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Enter reason..."
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Close</Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                if (!transactionToCancel || !cancelReason) return;
                                setIsCancelling(true);
                                try {
                                    await cancelTransaction.mutateAsync({
                                        id: transactionToCancel.id,
                                        reason: cancelReason
                                    });
                                    toast({ title: "Transaction cancelled" });
                                    setCancelDialogOpen(false);
                                    setTransactionToCancel(null);
                                } catch (e: any) {
                                    toast({ title: "Error", description: e.message || "Network error", variant: "destructive" });
                                } finally {
                                    setIsCancelling(false);
                                }
                            }}
                            disabled={!cancelReason || isCancelling}
                        >
                            {isCancelling ? "Cancelling..." : "Confirm Cancel"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
