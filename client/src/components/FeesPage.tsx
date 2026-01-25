import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, Column } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, MessageSquare } from "lucide-react";
import { printReceipt } from './Receipt';
import ReceiptDistributionModal from './ReceiptDistributionModal';
import { schoolConfig } from '@/lib/schoolConfig';
import type { Student } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

export interface FeeTransaction {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  date: string;
  transactionId: string;
  paymentMode?: string;
  remarks?: string;
  receiptSerial?: number; // persisted server-side; undefined for legacy entries
  createdAt?: string;
  status?: string;
  cancelReason?: string;
}

interface FeesPageProps {
  students: Student[];
  transactions: FeeTransaction[];
  // returns the created transaction (with id and transactionId)
  onAddTransaction: (transaction: Omit<FeeTransaction, 'id' | 'transactionId'>) => Promise<FeeTransaction> | FeeTransaction;
  onCancelTransaction?: (id: string, reason: string) => Promise<void>;
  userRole?: string;
}

export default function FeesPage({ students, transactions, onAddTransaction, onCancelTransaction, userRole = 'admin' }: FeesPageProps) {
  const { toast } = useToast();
  const [viewStudent, setViewStudent] = useState("all");
  const [amount, setAmount] = useState("");
  // Use local date for default
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  // payslip removed; use distribution modal directly
  const [paymentMode, setPaymentMode] = useState<string>('cash');
  const [remarks, setRemarks] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [distributionTx, setDistributionTx] = useState<FeeTransaction | null>(null);
  // New: class & section filters (dependencies order: choose class first, then section)
  const [filterGrade, setFilterGrade] = useState<'all' | string>('all');
  const [filterSection, setFilterSection] = useState<'all' | string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Date range for Excel export
  const [exportStart, setExportStart] = useState<string>('');
  const [exportEnd, setExportEnd] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [location] = useLocation();
  const [filterDate, setFilterDate] = useState<string | null>(null);

  // Cancellation state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState<FeeTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Pending Fees Filters
  const [pendingFilterClass, setPendingFilterClass] = useState<string>("all");
  const [pendingFilterSection, setPendingFilterSection] = useState<string>("all");

  // Feature Flags & Config
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/school-config', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setSchoolName(data.name || "School");
          let features = data.features;
          if (typeof features === 'string') {
            try { features = JSON.parse(features); } catch { features = {}; }
          }
          setSmsEnabled(!!features?.sms);
        }
      } catch (e) { console.error(e); }
    };
    fetchConfig();
  }, []);

  const studentsWithPendingFees = useMemo(() => {
    return students.map(s => {
      const yearly = parseFloat((s as any).yearlyFeeAmount || '0');
      const previousDue = parseFloat((s as any).previousYearDue || '0');
      const transportFee = parseFloat((s as any).transportFee || '0');
      const paid = transactions
        .filter(t => t.studentId === s.id && t.status !== 'cancelled')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const pending = (yearly + previousDue + transportFee) - paid;
      return { ...s, yearly, previousDue, transportFee, paid, pending };
    }).filter(s => s.pending > 0);
  }, [students, transactions]);

  const uniquePendingClasses = useMemo(() => {
    return Array.from(new Set(studentsWithPendingFees.map(s => s.grade))).sort((a, b) => Number(a) - Number(b));
  }, [studentsWithPendingFees]);

  const uniquePendingSections = useMemo(() => {
    const pool = pendingFilterClass === 'all' ? studentsWithPendingFees : studentsWithPendingFees.filter(s => s.grade === pendingFilterClass);
    return Array.from(new Set(pool.map(s => s.section))).sort();
  }, [studentsWithPendingFees, pendingFilterClass]);

  const filteredPendingStudents = useMemo(() => {
    return studentsWithPendingFees.filter(s => {
      const classMatch = pendingFilterClass === 'all' || s.grade === pendingFilterClass;
      const sectionMatch = pendingFilterSection === 'all' || s.section === pendingFilterSection;
      return classMatch && sectionMatch;
    });
  }, [studentsWithPendingFees, pendingFilterClass, pendingFilterSection]);

  // Reset section if class changes
  useEffect(() => {
    if (pendingFilterSection !== 'all' && !uniquePendingSections.includes(pendingFilterSection)) {
      setPendingFilterSection('all');
    }
  }, [pendingFilterClass, uniquePendingSections, pendingFilterSection]);

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

      // Style header
      worksheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pending-fees-${pendingFilterClass === 'all' ? 'all' : pendingFilterClass}-${pendingFilterSection === 'all' ? 'all' : pendingFilterSection}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast({ title: "Export failed", description: "Could not generate Excel file", variant: "destructive" });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'today') {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setFilterDate(today);
    } else {
      setFilterDate(null);
    }
  }, [location]);

  // API-based filters for Main Entry
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/classes/grades', { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : [])
      .then(data => setAvailableGrades(data))
      .catch(() => setAvailableGrades([]));
  }, []);

  useEffect(() => {
    setAvailableSections([]);
    if (!filterGrade || filterGrade === 'all') return;

    fetch(`/api/classes/${encodeURIComponent(filterGrade)}/sections`, { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : [])
      .then(data => setAvailableSections(data))
      .catch(() => setAvailableSections([]));
  }, [filterGrade]);

  // Filter students by grade then section
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

  // If section becomes invalid after grade change, reset to 'all'
  useEffect(() => {
    if (filterSection !== 'all' && availableSections.length > 0 && !availableSections.includes(filterSection)) {
      setFilterSection('all');
    }
  }, [filterGrade, availableSections, filterSection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === viewStudent);
    if (student) {
      try {
        setSubmitError(null);
        // preserve exact entered amount (no implicit numeric spinner adjustments)
        const raw = amount.trim();
        if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
          setSubmitError('Enter a valid amount (up to 2 decimals)');
          return;
        }
        const created = await onAddTransaction({
          studentId: student.id,
          studentName: student.name,
          // use Number on validated raw string to avoid float artifacts like 19999.99
          amount: Number(raw),
          date,
          paymentMode,
          remarks
        });
        // open distribution modal immediately for printing
        setDistributionTx(created);
        // setSelectedStudent(""); // Removed as we use viewStudent now
        setAmount("");
        // Reset to today (local)
        const now = new Date();
        setDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
        setPaymentMode('cash');
        setRemarks('');
      } catch (err: any) {
        setSubmitError(err?.message || 'Failed to record payment');
      }
    }
  };

  // compute viewed student's totals
  const viewedStudent = viewStudent === 'all' ? null : (students.find(s => s.id === viewStudent) || null);
  const studentTransactions = viewStudent === 'all'
    ? []
    : transactions.filter(t => t.studentId === viewStudent);
  // When viewing all, still apply class/section filter to transactions list
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

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportStart) params.set('start', exportStart);
      if (exportEnd) params.set('end', exportEnd);
      // Direct navigation gives browser native download handling & avoids blob memory
      const url = `/api/export/transactions/excel?${params.toString()}`;
      // Use a temporary iframe to avoid leaving current page
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      // Cleanup after some seconds
      setTimeout(() => {
        iframe.remove();
      }, 10000);
    } catch (e) {
      alert('Failed to initiate download');
    } finally {
      setExporting(false);
    }
  };


  const startEditing = (transaction: FeeTransaction) => { /* Placeholder if needed */ };

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
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Fee Management</h1>
        <p className="text-muted-foreground">Record payments and view history.</p>
        {filterDate && (
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded mt-2 flex items-center justify-between">
            <span>Showing transactions for: <strong>{filterDate}</strong></span>
            <button
              onClick={() => {
                setFilterDate(null);
                window.history.replaceState(null, '', '/fees');
              }}
              className="text-sm underline hover:text-blue-900"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      <Tabs defaultValue="entry" className="space-y-6">
        <TabsList>
          <TabsTrigger value="entry">Payment Entry</TabsTrigger>
          <TabsTrigger value="pending">Pending Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="space-y-6">
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
                            <SelectItem key={g} value={g}>Class {g}</SelectItem>
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
                            <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
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

                  {/* Student Summary & Payment Form */}
                  {viewedStudent && (
                    <div className="border-t pt-6 mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Summary Side */}
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
                                <span className="ml-2 font-medium">{viewedStudent.grade} - {viewedStudent.section}</span>
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
                              <p className="text-2xl font-bold">₹{totalPaid.toLocaleString('en-IN')}</p>
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

                        {/* Payment Form Side */}
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
        </TabsContent>

        <TabsContent value="pending">
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
                          <SelectItem key={c} value={c}>Class {c}</SelectItem>
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
                          <SelectItem key={s} value={s}>Section {s}</SelectItem>
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
        </TabsContent>
      </Tabs>

      <ReceiptDistributionModal
        open={!!distributionTx}
        onClose={() => setDistributionTx(null)}
        transaction={distributionTx}
        student={distributionTx ? students.find(s => s.id === distributionTx.studentId) || null : null}
        yearlyFeeAmount={distributionTx ? parseFloat(String((students.find(s => s.id === distributionTx.studentId) as any)?.yearlyFeeAmount || '0')) : undefined}
        previousYearDue={distributionTx ? parseFloat(String((students.find(s => s.id === distributionTx.studentId) as any)?.previousYearDue || '0')) : undefined}
        paidSoFar={distributionTx ? (transactions.filter(t => t.studentId === distributionTx.studentId && t.status !== 'cancelled').reduce((sum, t) => sum + (t.amount || 0), 0)) : undefined}
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
                  if (onCancelTransaction) {
                    await onCancelTransaction(transactionToCancel.id, cancelReason);
                    toast({ title: "Transaction cancelled" });
                    setCancelDialogOpen(false);
                  } else {
                    // Fallback if prop not provided (shouldn't happen with updated App.tsx)
                    const res = await fetch(`/api/fees/${transactionToCancel.id}/cancel`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                      },
                      body: JSON.stringify({ reason: cancelReason })
                    });

                    if (res.ok) {
                      toast({ title: "Transaction cancelled" });
                      setCancelDialogOpen(false);
                      window.location.reload();
                    } else {
                      const err = await res.json();
                      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
                    }
                  }
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
