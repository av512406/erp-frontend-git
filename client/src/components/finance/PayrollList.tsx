import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { DollarSign, Check } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export function PayrollList() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'MMMM'));
    const [selectedYear, setSelectedYear] = useState<string>(format(new Date(), 'yyyy'));

    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<any>(null); // Staff to pay

    const { data: staffList = [], isLoading } = useQuery({
        queryKey: ['staff-salary', selectedMonth, selectedYear],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/staff-salary-summary?month=${selectedMonth}&year=${selectedYear}`);
            return res.json();
        }
    });

    const payMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest('POST', '/api/salary-payments', data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-salary'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
            setPayModalOpen(false);
            setSelectedStaff(null);
            toast({ title: "Success", description: "Salary Payment Recorded" });
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message || "Failed to pay salary", variant: "destructive" });
        }
    });

    const handlePayClick = (staff: any) => {
        setSelectedStaff(staff);
        setPayModalOpen(true);
    };

    const handleConfirmPay = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaff) return;

        // Form data logic could be added here if we want to override amount/date
        const amount = (document.getElementById('pay-amount') as HTMLInputElement).value;
        const remarks = (document.getElementById('pay-remarks') as HTMLInputElement).value;
        const date = (document.getElementById('pay-date') as HTMLInputElement).value;

        payMutation.mutate({
            staffId: selectedStaff.id,
            amount: amount,
            month: selectedMonth,
            year: parseInt(selectedYear),
            paymentDate: date,
            remarks: remarks,
            status: 'Paid'
        });
    };

    const columns: Column<any>[] = [
        { header: "Staff Name", accessorKey: "name", className: "font-medium", sortable: true },
        { header: "Base Salary", accessorKey: "baseSalary", cell: row => formatCurrency(row.baseSalary), className: "font-mono" },
        {
            header: "Status",
            accessorKey: "status",
            cell: (row) => (
                <Badge variant={row.status === 'Paid' ? 'default' : 'secondary'} className={row.status === 'Paid' ? 'bg-green-600' : ''}>
                    {row.status}
                </Badge>
            )
        },
        {
            header: "Payment Date",
            cell: (row) => row.payment ? format(new Date(row.payment.paymentDate), 'dd MMM') : '-'
        },
        {
            header: "Actions",
            className: "text-right",
            cell: (row) => (
                <div className="flex justify-end">
                    {row.status === 'Paid' ? (
                        <div className="flex items-center text-green-600 gap-1 text-sm font-medium">
                            <Check className="w-4 h-4" /> Paid
                        </div>
                    ) : (
                        <Button size="sm" onClick={() => handlePayClick(row)}>
                            <DollarSign className="w-4 h-4 mr-1" /> Pay
                        </Button>
                    )}
                </div>
            )
        }
    ];

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                    <div className="grid gap-1">
                        <Label>Month</Label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1">
                        <Label>Year</Label>
                        <Select value={String(selectedYear)} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Showing payroll for</p>
                    <p className="font-semibold">{selectedMonth} {selectedYear}</p>
                </div>
            </div>

            <div className="border rounded-md p-4">
                <DataTable columns={columns} data={staffList} searchKey="name" pageSize={30} />
            </div>

            <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pay Salary - {selectedStaff?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleConfirmPay} className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Amount</Label>
                            <Input
                                id="pay-amount"
                                type="number"
                                defaultValue={selectedStaff?.baseSalary}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Payment Date</Label>
                            <Input id="pay-date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                        </div>
                        <div className="grid gap-2">
                            <Label>Remarks</Label>
                            <Input id="pay-remarks" placeholder="Optional" />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)}>Cancel</Button>
                            <Button type="submit">Confirm Payment</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
