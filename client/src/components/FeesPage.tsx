import { useState, useMemo, useEffect } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download } from "lucide-react";
import { printReceipt } from './Receipt';
import ReceiptDistributionModal from './ReceiptDistributionModal';
import { schoolConfig } from '@/lib/schoolConfig';
import type { Student } from '@shared/schema';

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
}

interface FeesPageProps {
  students: Student[];
  transactions: FeeTransaction[];
  // returns the created transaction (with id and transactionId)
  onAddTransaction: (transaction: Omit<FeeTransaction, 'id' | 'transactionId'>) => Promise<FeeTransaction> | FeeTransaction;
}

export default function FeesPage({ students, transactions, onAddTransaction }: FeesPageProps) {

  const [viewStudent, setViewStudent] = useState("all");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'today') {
      setFilterDate(new Date().toISOString().split('T')[0]);
    } else {
      setFilterDate(null);
    }
  }, [location]);

  // Unique grades & sections (sections depend on selected grade)
  const uniqueGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).sort((a, b) => Number(a) - Number(b)), [students]);
  const uniqueSectionsForGrade = useMemo(() => {
    const source = filterGrade === 'all' ? students : students.filter(s => s.grade === filterGrade);
    return Array.from(new Set(source.map(s => s.section))).sort();
  }, [students, filterGrade]);

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
  if (filterSection !== 'all' && !uniqueSectionsForGrade.includes(filterSection)) {
    setFilterSection('all');
  }

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
        setDate(new Date().toISOString().split('T')[0]);
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
      txs = txs.filter(t => t.date === filterDate);
    }
    return txs;
  }, [viewStudent, transactions, filteredTransactionIds, studentTransactions, filterDate]);
  const totalPaid = studentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const yearlyFee = viewedStudent ? parseFloat((viewedStudent as any).yearlyFeeAmount || '0') : 0;
  const balance = yearlyFee - totalPaid;

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
                          {uniqueGrades.map(g => (
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
                          {uniqueSectionsForGrade.map(sec => (
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
                              <p className="text-sm text-muted-foreground">Total Paid</p>
                              <p className="text-2xl font-bold">₹{totalPaid.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg col-span-2">
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
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt Serial</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No transactions recorded yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedTransactions.map((transaction) => (
                          <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                            <TableCell className="font-mono text-sm">{transaction.receiptSerial != null ? String(transaction.receiptSerial).padStart(4, '0') : '—'}</TableCell>
                            <TableCell className="font-mono text-sm">{transaction.transactionId}</TableCell>
                            <TableCell className="font-medium">{transaction.studentName}</TableCell>
                            <TableCell className="font-semibold">₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setDistributionTx(transaction)}
                              >
                                Print Receipt
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pending Fees List</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const pendingStudents = students.map(s => {
                      const yearly = parseFloat((s as any).yearlyFeeAmount || '0');
                      const paid = transactions.filter(t => t.studentId === s.id).reduce((sum, t) => sum + (t.amount || 0), 0);
                      const pending = yearly - paid;
                      return { ...s, yearly, paid, pending };
                    }).filter(s => s.pending > 0);

                    const csvContent = [
                      ['Admission Number', 'Name', 'Father Name', 'Class', 'Section', 'Yearly Fee', 'Total Paid', 'Pending Amount'].join(','),
                      ...pendingStudents.map(s => [
                        s.admissionNumber,
                        `"${s.name}"`,
                        `"${s.fatherName || ''}"`,
                        s.grade,
                        s.section,
                        s.yearly,
                        s.paid,
                        s.pending
                      ].join(','))
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pending-fees-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-4 h-4" />
                  Export Pending List
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Father Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Yearly Fee</TableHead>
                      <TableHead>Total Paid</TableHead>
                      <TableHead>Pending Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(s => {
                      const yearly = parseFloat((s as any).yearlyFeeAmount || '0');
                      const paid = transactions.filter(t => t.studentId === s.id).reduce((sum, t) => sum + (t.amount || 0), 0);
                      const pending = yearly - paid;
                      return { ...s, yearly, paid, pending };
                    })
                      .filter(s => s.pending > 0)
                      .map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono">{student.admissionNumber}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.fatherName}</TableCell>
                          <TableCell>{student.grade}</TableCell>
                          <TableCell>{student.section}</TableCell>
                          <TableCell>₹{student.yearly.toLocaleString('en-IN')}</TableCell>
                          <TableCell>₹{student.paid.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="font-bold text-red-600">₹{student.pending.toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
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
        paidSoFar={distributionTx ? (transactions.filter(t => t.studentId === distributionTx.studentId).reduce((sum, t) => sum + (t.amount || 0), 0)) : undefined}
      />
    </div>
  );
}
