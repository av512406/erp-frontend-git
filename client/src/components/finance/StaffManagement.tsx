import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Edit, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Staff {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    position: string;
    monthlySalary: number;
    joiningDate?: string;
    status: string;
}

export function StaffManagement() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        position: '',
        monthlySalary: '',
        joiningDate: '',
        status: 'active'
    });

    // Fetch all staff
    const { data: staffList = [], isLoading } = useQuery<Staff[]>({
        queryKey: ['staff'],
        queryFn: async () => {
            const res = await fetch('/api/staff', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch staff');
            return res.json();
        }
    });

    // Add/Update staff mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editingStaff ? `/api/staff/${editingStaff.id}` : '/api/staff';
            const method = editingStaff ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to save staff');
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: editingStaff ? "Staff updated" : "Staff added successfully" });
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            queryClient.invalidateQueries({ queryKey: ['staff-salary-summary'] });
            handleCloseDialog();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    // Delete staff mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/staff/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to deactivate staff');
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Staff deactivated" });
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            queryClient.invalidateQueries({ queryKey: ['staff-salary-summary'] });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleOpenAddDialog = () => {
        setEditingStaff(null);
        setForm({
            name: '',
            email: '',
            phone: '',
            position: '',
            monthlySalary: '',
            joiningDate: '',
            status: 'active'
        });
        setDialogOpen(true);
    };

    const handleOpenEditDialog = (staff: Staff) => {
        setEditingStaff(staff);
        setForm({
            name: staff.name,
            email: staff.email || '',
            phone: staff.phone || '',
            position: staff.position,
            monthlySalary: staff.monthlySalary.toString(),
            joiningDate: staff.joiningDate || '',
            status: staff.status
        });
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingStaff(null);
    };

    const handleSave = () => {
        if (!form.name || !form.position || !form.monthlySalary) {
            toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
            return;
        }

        saveMutation.mutate({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            position: form.position,
            monthlySalary: form.monthlySalary,
            joiningDate: form.joiningDate || null,
            status: form.status
        });
    };

    const handleDeactivate = (id: string) => {
        if (confirm("Are you sure you want to deactivate this staff member?")) {
            deleteMutation.mutate(id);
        }
    };

    const columns: Column<Staff>[] = [
        { header: "Name", accessorKey: "name", className: "font-medium", sortable: true },
        { header: "Position", accessorKey: "position", sortable: true },
        {
            header: "Monthly Salary",
            cell: (row: Staff) => formatCurrency(row.monthlySalary),
            className: "font-mono"
        },
        { header: "Phone", accessorKey: "phone", cell: (row: Staff) => row.phone || '-' },
        {
            header: "Status",
            cell: (row: Staff) => (
                <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                    {row.status}
                </Badge>
            )
        },
        {
            header: "Actions",
            className: "text-right",
            cell: (row: Staff) => (
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenEditDialog(row)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    {row.status === 'active' && (
                        <Button size="sm" variant="destructive" onClick={() => handleDeactivate(row.id)}>
                            <UserMinus className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )
        }
    ];

    if (isLoading) {
        return <div className="text-center py-8">Loading staff...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Staff Management</h2>
                    <p className="text-muted-foreground">Add and manage staff members</p>
                </div>
                <Button onClick={handleOpenAddDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Staff
                </Button>
            </div>

            <DataTable columns={columns} data={staffList} searchKey="name" pageSize={20} />

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent aria-describedby="staff-dialog-description">
                    <DialogHeader>
                        <DialogTitle>{editingStaff ? 'Edit Staff' : 'Add New Staff'}</DialogTitle>
                        <DialogDescription id="staff-dialog-description">
                            Fill in the staff member details below
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position">Position *</Label>
                                <select
                                    id="position"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.position}
                                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                                >
                                    <option value="">Select position</option>
                                    <option value="Teacher">Teacher</option>
                                    <option value="Accountant">Accountant</option>
                                    <option value="Admin Staff">Admin Staff</option>
                                    <option value="Peon">Peon</option>
                                    <option value="Librarian">Librarian</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="monthlySalary">Monthly Salary *</Label>
                                <Input
                                    id="monthlySalary"
                                    type="number"
                                    value={form.monthlySalary}
                                    onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="joiningDate">Joining Date</Label>
                                <Input
                                    id="joiningDate"
                                    type="date"
                                    value={form.joiningDate}
                                    onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                            <Button onClick={handleSave} disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? 'Saving...' : editingStaff ? 'Update' : 'Add'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
