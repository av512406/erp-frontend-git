import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Plus, Search, Wallet, Bus, Car, Eye, History, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface TransportRecord {
    transport_record_id: string;
    student_id: string;
    student_name: string;
    admission_number: string;
    father_name: string;
    grade: string;
    section: string;
    transport_type: string;
    yearly_fee: number;
    total_paid: number;
}

interface Student {
    id: string;
    name: string;
    admissionNumber: string;
    fatherName: string;
    grade: string;
    section: string;
}

interface Transaction {
    id: string;
    amount: string;
    payment_date: string;
    remarks: string;
}

export default function TransportPage() {
    const { toast } = useToast();
    const [assignedStudents, setAssignedStudents] = useState<TransportRecord[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);

    // Add Student State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newAssignment, setNewAssignment] = useState({
        studentId: '',
        transportType: 'Bus',
        yearlyFee: ''
    });

    // Details & Payment Dialog State
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<TransportRecord | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [payData, setPayData] = useState({
        amount: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        remarks: ''
    });
    const [isPayMode, setIsPayMode] = useState(false); // Toggle within dialog to show payment form

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [transportRes, studentsRes] = await Promise.all([
                fetch('/api/transport/students', { headers: getAuthHeaders() }),
                fetch('/api/students', { headers: getAuthHeaders() })
            ]);

            if (transportRes.ok) {
                const data = await transportRes.json();
                setAssignedStudents(data.map((d: any) => ({
                    ...d,
                    yearly_fee: Number(d.yearly_fee),
                    total_paid: Number(d.total_paid)
                })));
            }
            if (studentsRes.ok) {
                setAllStudents(await studentsRes.json());
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async (studentId: string) => {
        try {
            const res = await fetch(`/api/transport/students/${studentId}/transactions`, { headers: getAuthHeaders() });
            if (res.ok) {
                setTransactions(await res.json());
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAssign = async () => {
        if (!newAssignment.studentId || newAssignment.yearlyFee === '') {
            toast({ title: "Error", description: "Student and Fee are required", variant: "destructive" });
            return;
        }

        try {
            const res = await fetch('/api/transport/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    studentId: newAssignment.studentId,
                    transportType: newAssignment.transportType,
                    yearlyFee: Number(newAssignment.yearlyFee)
                })
            });

            if (res.ok) {
                toast({ title: "Success", description: "Student assigned to transport" });
                setIsAddDialogOpen(false);
                setNewAssignment({ studentId: '', transportType: 'Bus', yearlyFee: '' });
                fetchData();
            } else {
                throw new Error("Failed to assign");
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to assign student", variant: "destructive" });
        }
    };

    const handlePayment = async () => {
        if (!payData.amount || payData.amount === '' || !selectedStudent) {
            toast({ title: "Error", description: "Amount is required", variant: "destructive" });
            return;
        }

        try {
            const res = await fetch('/api/transport/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    studentId: selectedStudent.student_id,
                    amount: Number(payData.amount),
                    paymentDate: payData.paymentDate,
                    remarks: payData.remarks
                })
            });

            if (res.ok) {
                toast({ title: "Success", description: "Payment recorded successfully" });
                setIsPayMode(false); // Switch back to history view
                setPayData({ amount: '', paymentDate: format(new Date(), 'yyyy-MM-dd'), remarks: '' });

                // Refresh data
                await fetchTransactions(selectedStudent.student_id);
                // We also need to update the total_paid for the selected student locally to reflect changes immediately in UI
                fetchData();

                // Optimistic local update for smoothing UI
                setSelectedStudent(prev => prev ? { ...prev, total_paid: prev.total_paid + Number(payData.amount) } : null);

            } else {
                throw new Error("Failed to record payment");
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
        }
    };

    const openDetails = (record: TransportRecord) => {
        setSelectedStudent(record);
        setTransactions([]);
        setIsPayMode(false);
        setPayData({ amount: '', paymentDate: format(new Date(), 'yyyy-MM-dd'), remarks: '' });
        setIsDetailsOpen(true);
        fetchTransactions(record.student_id);
    };

    const availableStudents = useMemo(() => {
        const assignedIds = new Set(assignedStudents.map(r => r.student_id));
        return allStudents.filter(s => !assignedIds.has(s.id));
    }, [allStudents, assignedStudents]);

    const filteredRecords = assignedStudents.filter(r => {
        const searchLower = searchTerm.toLowerCase();
        return r.student_name.toLowerCase().includes(searchLower) ||
            r.admission_number.toLowerCase().includes(searchLower) ||
            (r.father_name && r.father_name.toLowerCase().includes(searchLower));
    });

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Transport Management</h1>
                    <p className="text-muted-foreground">Manage transport assignments and fees</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" /> Add Student</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Student to Transport</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Student</Label>
                                <Select
                                    value={newAssignment.studentId}
                                    onValueChange={(val) => setNewAssignment({ ...newAssignment, studentId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Student" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableStudents.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} ({s.admissionNumber}) - {s.fatherName ? `F: ${s.fatherName}` : ''} - {s.grade} {s.section}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Transport Type</Label>
                                <Select
                                    value={newAssignment.transportType}
                                    onValueChange={(val) => setNewAssignment({ ...newAssignment, transportType: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Bus">Bus</SelectItem>
                                        <SelectItem value="Van">Van</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Yearly Transport Fee (₹)</Label>
                                <Input
                                    type="number"
                                    placeholder="Enter Amount"
                                    value={newAssignment.yearlyFee}
                                    onChange={e => setNewAssignment({ ...newAssignment, yearlyFee: e.target.value })}
                                />
                            </div>
                            <Button className="w-full" onClick={handleAssign}>Save Assignment</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Transport Students</CardTitle>
                        <CardDescription>
                            Total Using Transport: {assignedStudents.length}
                        </CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search student..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Information</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Yearly Fee</TableHead>
                                <TableHead>Paid</TableHead>
                                <TableHead>Balance</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No students using transport found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRecords.map(record => {
                                    const balance = record.yearly_fee - record.total_paid;
                                    return (
                                        <TableRow key={record.transport_record_id}>
                                            <TableCell>
                                                <div className="font-medium">{record.student_name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    ID: {record.admission_number}
                                                    {record.father_name && ` • F: ${record.father_name}`}
                                                </div>
                                            </TableCell>
                                            <TableCell>{record.grade} - {record.section}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {record.transport_type === 'Bus' ? <Bus className="h-4 w-4 text-blue-500" /> : <Car className="h-4 w-4 text-orange-500" />}
                                                    {record.transport_type}
                                                </div>
                                            </TableCell>
                                            <TableCell>₹{record.yearly_fee.toLocaleString()}</TableCell>
                                            <TableCell className="text-green-600">₹{record.total_paid.toLocaleString()}</TableCell>
                                            <TableCell className={balance > 0 ? "text-red-500 font-bold" : "text-gray-500"}>
                                                ₹{balance.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => openDetails(record)}>
                                                    <Eye className="h-4 w-4 mr-2" /> Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* DETAILS & PAYMENT DIALOG */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Transport Details</DialogTitle>
                    </DialogHeader>
                    {selectedStudent && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">₹{selectedStudent.yearly_fee.toLocaleString()}</div>
                                        <p className="text-xs text-muted-foreground">Total Fee</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold text-green-600">₹{selectedStudent.total_paid.toLocaleString()}</div>
                                        <p className="text-xs text-muted-foreground">Start: {selectedStudent.transport_type}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className={`text-2xl font-bold ${(selectedStudent.yearly_fee - selectedStudent.total_paid) > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                            ₹{(selectedStudent.yearly_fee - selectedStudent.total_paid).toLocaleString()}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Balance Due</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h3 className="font-semibold">{selectedStudent.student_name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedStudent.grade} - {selectedStudent.section} • ID: {selectedStudent.admission_number}
                                    </p>
                                    {selectedStudent.father_name && (
                                        <p className="text-sm text-muted-foreground">Father: {selectedStudent.father_name}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {!isPayMode ? (
                                        <Button onClick={() => setIsPayMode(true)}>
                                            <Plus className="h-4 w-4 mr-2" /> Add Payment
                                        </Button>
                                    ) : (
                                        <Button variant="outline" onClick={() => setIsPayMode(false)}>
                                            Cancel Payment
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {isPayMode ? (
                                <div className="p-4 border rounded-lg bg-muted/50 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <h4 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> New Payment</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Amount (₹)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Enter Amount"
                                                value={payData.amount}
                                                onChange={e => setPayData({ ...payData, amount: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Date</Label>
                                            <Input
                                                type="date"
                                                value={payData.paymentDate}
                                                onChange={e => setPayData({ ...payData, paymentDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Remarks</Label>
                                            <Input
                                                placeholder="Check no, Transaction Ref etc"
                                                value={payData.remarks}
                                                onChange={e => setPayData({ ...payData, remarks: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <Button className="w-full" onClick={handlePayment}>Save Payment</Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Payment History</h4>
                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                    <TableHead>Remarks</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transactions.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                                            No payments found
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    transactions.map(t => (
                                                        <TableRow key={t.id}>
                                                            <TableCell>{format(new Date(t.payment_date), 'dd MMM yyyy')}</TableCell>
                                                            <TableCell>₹{Number(t.amount).toLocaleString()}</TableCell>
                                                            <TableCell>{t.remarks || '-'}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
