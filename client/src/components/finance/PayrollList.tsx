import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, IndianRupee, Calendar, User } from "lucide-react";
import { format } from "date-fns";

interface StaffSummary {
    id: string;
    name: string;
    baseSalary: number;
    ytdTotal: number;
    lastPaymentDate: string | null;
    qualification?: string;
    mobileNumber?: string;
}

interface StaffPayment {
    id: string;
    staff_id: string;
    amount: number;
    month: string;
    year: string;
    payment_date: string;
    status: string;
    remarks: string | null;
    created_at: string;
}

interface PaymentHistory {
    staff: {
        id: string;
        name: string;
        baseSalary: number;
    };
    payments: StaffPayment[];
}

interface PayrollListProps {
    selectedSessionId: string;
}

export function PayrollList({ selectedSessionId }: PayrollListProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedStaff, setSelectedStaff] = useState<StaffSummary | null>(null);
    const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

    // Fetch all staff with summary
    const { data: staffList = [], isLoading } = useQuery<StaffSummary[]>({
        queryKey: ['staff-salary-summary', selectedSessionId], // Global staff summary
        queryFn: async () => {
            const res = await fetch(`/api/staff-salary-summary?sessionId=${selectedSessionId}`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch staff');
            return res.json();
        }
    });

    // Fetch payment history for selected staff
    const { data: paymentHistory } = useQuery<PaymentHistory>({
        queryKey: ['staff-payments', selectedStaff?.id, selectedSessionId],
        queryFn: async () => {
            if (!selectedStaff) throw new Error('No staff selected');
            const res = await fetch(`/api/staff-payments/${selectedStaff.id}?sessionId=${selectedSessionId}`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch payment history');
            return res.json();
        },
        enabled: !!selectedStaff
    });

    // Payment form state
    const [paymentForm, setPaymentForm] = useState({
        month: '',
        year: new Date().getFullYear().toString(),
        amount: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        remarks: ''
    });

    // Record payment mutation
    const recordPayment = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/salary-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ ...data, sessionId: selectedSessionId })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to record payment');
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Payment recorded successfully" });
            queryClient.invalidateQueries({ queryKey: ['staff-salary-summary'] });
            queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats'] }); // Update dashboard stats
            setPaymentDialogOpen(false);
            resetPaymentForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const resetPaymentForm = () => {
        setPaymentForm({
            month: '',
            year: new Date().getFullYear().toString(),
            amount: selectedStaff?.baseSalary.toString() || '',
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            remarks: ''
        });
    };

    const handleOpenPaymentHistory = (staff: StaffSummary) => {
        setSelectedStaff(staff);
        setPaymentHistoryOpen(true);
    };

    const handleOpenPaymentDialog = (staff: StaffSummary) => {
        setSelectedStaff(staff);
        setPaymentForm({
            month: '',
            year: new Date().getFullYear().toString(),
            amount: staff.baseSalary.toString(),
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            remarks: ''
        });
        setPaymentDialogOpen(true);
    };

    const handleRecordPayment = () => {
        if (!selectedStaff || !paymentForm.month || !paymentForm.year || !paymentForm.amount || !paymentForm.paymentDate) {
            toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
            return;
        }

        recordPayment.mutate({
            staffId: selectedStaff.id,
            amount: paymentForm.amount,
            month: paymentForm.month,
            year: parseInt(paymentForm.year),
            paymentDate: paymentForm.paymentDate,
            status: 'Paid',
            remarks: paymentForm.remarks || null
        });
    };

    if (isLoading) {
        return <div className="text-center py-8">Loading staff...</div>;
    }

    if (staffList.length === 0) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center space-y-3">
                        <User className="h-12 w-12 mx-auto text-muted-foreground" />
                        <h3 className="text-lg font-semibold">No Staff Members Found</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            No teachers are registered in the system yet. Staff members need to be added before you can manage payroll.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {staffList.map((staff) => (
                    <Card key={staff.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                {staff.name}
                            </CardTitle>
                            <CardDescription>
                                {staff.qualification && <span>{staff.qualification}</span>}
                                {staff.mobileNumber && <span className="ml-2">• {staff.mobileNumber}</span>}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Monthly Salary</span>
                                <span className="font-semibold">{formatCurrency(staff.baseSalary)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">YTD Total</span>
                                <span className="font-semibold text-green-600">{formatCurrency(staff.ytdTotal)}</span>
                            </div>
                            {staff.lastPaymentDate && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    Last paid: {format(new Date(staff.lastPaymentDate), 'MMM dd, yyyy')}
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleOpenPaymentHistory(staff)}
                                >
                                    View History
                                </Button>
                                <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleOpenPaymentDialog(staff)}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Pay
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Payment History Dialog */}
            <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" aria-describedby="payment-history-description">
                    <DialogHeader>
                        <DialogTitle>Payment History - {selectedStaff?.name}</DialogTitle>
                        <DialogDescription id="payment-history-description">
                            Base Salary: {selectedStaff && formatCurrency(selectedStaff.baseSalary)} / month
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {paymentHistory && paymentHistory.payments.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Month/Year</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Remarks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paymentHistory.payments.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell>{format(new Date(payment.payment_date), 'MMM dd, yyyy')}</TableCell>
                                            <TableCell>{payment.month} {payment.year}</TableCell>
                                            <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${payment.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {payment.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>{payment.remarks || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No payment history found
                            </div>
                        )}
                        <div className="flex justify-end">
                            <Button onClick={() => handleOpenPaymentDialog(selectedStaff!)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Record New Payment
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogContent aria-describedby="payment-dialog-description">
                    <DialogHeader>
                        <DialogTitle>Record Payment - {selectedStaff?.name}</DialogTitle>
                        <DialogDescription id="payment-dialog-description">
                            Base Salary: {selectedStaff && formatCurrency(selectedStaff.baseSalary)} / month
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="month">Month *</Label>
                                <select
                                    id="month"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                    value={paymentForm.month}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, month: e.target.value })}
                                >
                                    <option value="">Select month</option>
                                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">Year *</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    value={paymentForm.year}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, year: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount *</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="paymentDate">Payment Date *</Label>
                            <Input
                                id="paymentDate"
                                type="date"
                                value={paymentForm.paymentDate}
                                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="remarks">Remarks</Label>
                            <Textarea
                                id="remarks"
                                value={paymentForm.remarks}
                                onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                                placeholder="Optional notes about this payment"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleRecordPayment} disabled={recordPayment.isPending}>
                                {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
