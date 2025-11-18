import { useState, useMemo } from "react";
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
import { FileText } from "lucide-react";
import PayslipModal from "./PayslipModal";
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
}

interface FeesPageProps {
  students: Student[];
  transactions: FeeTransaction[];
  // returns the created transaction (with id and transactionId)
  onAddTransaction: (transaction: Omit<FeeTransaction, 'id' | 'transactionId'>) => Promise<FeeTransaction> | FeeTransaction;
}

export default function FeesPage({ students, transactions, onAddTransaction }: FeesPageProps) {
  const [selectedStudent, setSelectedStudent] = useState("");
  const [viewStudent, setViewStudent] = useState("all");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPayslip, setSelectedPayslip] = useState<FeeTransaction | null>(null);
  const [paymentMode, setPaymentMode] = useState<string>('cash');
  const [remarks, setRemarks] = useState<string>('');
  // New: class & section filters (dependencies order: choose class first, then section)
  const [filterGrade, setFilterGrade] = useState<'all' | string>('all');
  const [filterSection, setFilterSection] = useState<'all' | string>('all');

  // Unique grades & sections (sections depend on selected grade)
  const uniqueGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).sort((a,b)=> Number(a)-Number(b)), [students]);
  const uniqueSectionsForGrade = useMemo(() => {
    const source = filterGrade === 'all' ? students : students.filter(s => s.grade === filterGrade);
    return Array.from(new Set(source.map(s => s.section))).sort();
  }, [students, filterGrade]);

  // Filter students by grade then section
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const gradeOk = filterGrade === 'all' || s.grade === filterGrade;
      const sectionOk = filterSection === 'all' || s.section === filterSection;
      return gradeOk && sectionOk;
    });
  }, [students, filterGrade, filterSection]);

  // If section becomes invalid after grade change, reset to 'all'
  if (filterSection !== 'all' && !uniqueSectionsForGrade.includes(filterSection)) {
    setFilterSection('all');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === selectedStudent);
    if (student) {
      const created = await onAddTransaction({
        studentId: student.id,
        studentName: student.name,
        amount: parseFloat(amount),
        date,
        paymentMode,
        remarks
      });
      // open payslip for the newly created transaction
      setSelectedPayslip(created);
      setSelectedStudent("");
      setAmount("");
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('cash');
      setRemarks('');
    }
  };

  // compute viewed student's totals
  const viewedStudent = viewStudent === 'all' ? null : (students.find(s => s.id === viewStudent) || null);
  const studentTransactions = viewStudent === 'all'
    ? []
    : transactions.filter(t => t.studentId === viewStudent);
  // When viewing all, still apply class/section filter to transactions list
  const filteredTransactionIds = useMemo(() => new Set(filteredStudents.map(s => s.id)), [filteredStudents]);
  const displayedTransactions = viewStudent === 'all'
    ? transactions.filter(t => filteredTransactionIds.has(t.studentId))
    : studentTransactions;
  const totalPaid = studentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const yearlyFee = viewedStudent ? parseFloat((viewedStudent as any).yearlyFeeAmount || '0') : 0;
  const balance = yearlyFee - totalPaid;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Fee Management</h1>
        <p className="text-muted-foreground">Record and track student fee payments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student">Student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent} required>
                  <SelectTrigger id="student" data-testid="select-student">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.admissionNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  data-testid="input-amount"
                />
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
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes (e.g., receipt no., reference)"
                  data-testid="input-remarks"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-record-payment">
                Record Payment
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>View Student</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="view-student">Student</Label>
                  <Select value={viewStudent} onValueChange={setViewStudent}>
                    <SelectTrigger id="view-student">
                      <SelectValue placeholder="Select a student to view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {filteredStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} ({student.admissionNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {viewedStudent && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Yearly Fee</p>
                    <p className="text-lg font-semibold">₹{yearlyFee.toLocaleString('en-IN')}</p>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-lg font-semibold">₹{totalPaid.toLocaleString('en-IN')}</p>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className={`text-lg font-semibold ${balance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{balance.toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                          <TableCell className="font-mono text-sm">{transaction.transactionId}</TableCell>
                          <TableCell className="font-medium">{transaction.studentName}</TableCell>
                          <TableCell className="font-semibold">₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPayslip(transaction)}
                              className="gap-2"
                              data-testid={`button-payslip-${transaction.id}`}
                            >
                              <FileText className="w-4 h-4" />
                              Payslip
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
      </div>

      <PayslipModal
        transaction={selectedPayslip}
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
      />
    </div>
  );
}
