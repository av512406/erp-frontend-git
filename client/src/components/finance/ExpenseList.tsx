import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Expense } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ExpenseListProps {
    selectedSessionId: string;
}

export function ExpenseList({ selectedSessionId }: ExpenseListProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        date: format(new Date(), "yyyy-MM-dd"),
        category: "other",
        paymentMethod: "cash"
    });

    const { data: expenses = [], isLoading } = useQuery<Expense[]>({
        queryKey: ['expenses', selectedSessionId],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/expenses?sessionId=${selectedSessionId}`);
            return res.json();
        },
        enabled: !!selectedSessionId
    });

    const addMutation = useMutation({
        mutationFn: async (data: Partial<Expense>) => {
            const res = await apiRequest('POST', '/api/expenses', {
                ...data,
                amount: data.amount?.toString(), // Send as string for decimal type
                sessionId: selectedSessionId
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
            setIsAddOpen(false);
            setNewExpense({ date: format(new Date(), "yyyy-MM-dd"), category: "other", paymentMethod: "cash" });
            toast({ title: "Success", description: "Expense recorded" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to record expense", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest('DELETE', `/api/expenses/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
            toast({ title: "Success", description: "Expense deleted" });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExpense.description || !newExpense.amount) return;
        addMutation.mutate(newExpense);
    };

    const columns: Column<Expense>[] = [
        { header: "Date", accessorKey: "date", cell: (row) => format(new Date(row.date), "dd MMM yyyy"), sortable: true },
        { header: "Description", accessorKey: "description", className: "font-medium" },
        { header: "Category", accessorKey: "category", cell: (row) => <span className="capitalize">{row.category}</span> },
        { header: "Amount", accessorKey: "amount", cell: (row) => formatCurrency(Number(row.amount)), className: "text-right font-mono", sortable: true },
        { header: "Payment Mode", accessorKey: "paymentMethod" },
        {
            header: "Actions",
            className: "text-right",
            cell: (row) => (
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(row.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Expenses</h2>
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Add Expense
                </Button>
            </div>

            <div className="border rounded-md p-4">
                <DataTable columns={columns} data={expenses} searchKey="description" />
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Expense</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Input
                                value={newExpense.description || ''}
                                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Amount</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={newExpense.amount || ''}
                                    onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={newExpense.date ? String(newExpense.date) : ''}
                                    onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Category</Label>
                                <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="utilities">Utilities</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="events">Events</SelectItem>
                                        <SelectItem value="salary">Salary (Manual)</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Payment Method</Label>
                                <Select value={newExpense.paymentMethod || 'cash'} onValueChange={(v) => setNewExpense({ ...newExpense, paymentMethod: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="cheque">Cheque</SelectItem>
                                        <SelectItem value="upi">UPI</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button type="submit">Save Expense</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
