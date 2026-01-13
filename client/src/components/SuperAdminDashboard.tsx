import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Shield, ShieldAlert, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { getAuthHeaders } from "@/lib/auth";

const schoolSchema = z.object({
    name: z.string().min(1, "Name is required"),
    slug: z.string().min(1, "Slug is required"),
    address: z.string().optional(),
    phone: z.string().optional(),
    logoUrl: z.string().optional(),
    features: z.object({
        attendance: z.boolean().default(false),
        transport: z.boolean().default(false),
    }).optional(),
});

type SchoolFormValues = z.infer<typeof schoolSchema>;

interface School {
    id: string;
    name: string;
    slug: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    is_active: boolean;
    features?: { attendance: boolean; transport?: boolean };
}

const adminSchema = z.object({
    username: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type AdminFormValues = z.infer<typeof adminSchema>;

export default function SuperAdminDashboard() {
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const { toast } = useToast();

    const form = useForm<SchoolFormValues>({
        resolver: zodResolver(schoolSchema),
        defaultValues: {
            name: "",
            slug: "",
            address: "",
            phone: "",
            logoUrl: "",
            features: { attendance: false, transport: false },
        },
    });

    const adminForm = useForm<AdminFormValues>({
        resolver: zodResolver(adminSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    useEffect(() => {
        fetchSchools();
    }, []);

    const fetchSchools = async () => {
        try {
            const res = await fetch("/api/schools", { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setSchools(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: SchoolFormValues) => {
        try {
            const url = isEditing && selectedSchool ? `/api/schools/${selectedSchool.id}` : "/api/schools";
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                toast({ title: "Success", description: `School ${isEditing ? 'updated' : 'created'} successfully` });
                setOpen(false);
                form.reset();
                setIsEditing(false);
                setSelectedSchool(null);
                fetchSchools();
            } else {
                const err = await res.json();
                toast({ title: "Error", description: err.message || "Operation failed", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
        }
    };

    const toggleStatus = async (school: School) => {
        try {
            const res = await fetch(`/api/schools/${school.id}/toggle-status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ isActive: !school.is_active }),
            });
            if (res.ok) {
                toast({ title: "Success", description: `School ${!school.is_active ? 'activated' : 'deactivated'}` });
                fetchSchools();
            } else {
                toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
        }
    };

    const onAdminSubmit = async (data: AdminFormValues) => {
        if (!selectedSchool) return;
        try {
            const res = await fetch(`/api/schools/${selectedSchool.id}/admin`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                toast({ title: "Success", description: "Admin credentials updated" });
                setAdminOpen(false);
                adminForm.reset();
            } else {
                const err = await res.json();
                toast({ title: "Error", description: err.message || "Failed to update admin", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
        }
    };

    const openAdminDialog = (school: School) => {
        setSelectedSchool(school);
        // Pre-fill with a default pattern if needed, or leave empty
        adminForm.setValue("username", `admin@${school.slug}.com`);
        adminForm.setValue("password", "");
        setAdminOpen(true);
    };

    const openEditDialog = (school: School) => {
        setSelectedSchool(school);
        setIsEditing(true);
        form.reset({
            name: school.name,
            slug: school.slug,
            address: school.address || "",
            phone: school.phone || "",
            logoUrl: school.logoUrl || "",
            features: {
                attendance: school.features?.attendance || false,
                transport: school.features?.transport || false,
            },
        });
        setOpen(true);
    };

    const openDeleteAlert = (school: School) => {
        setSelectedSchool(school);
        setDeleteAlertOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedSchool) return;
        try {
            const res = await fetch(`/api/schools/${selectedSchool.id}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            if (res.ok) {
                toast({ title: "Success", description: "School deleted successfully" });
                fetchSchools();
            } else {
                toast({ title: "Error", description: "Failed to delete school", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
        } finally {
            setDeleteAlertOpen(false);
            setSelectedSchool(null);
        }
    };

    const handleDialogChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setIsEditing(false);
            setSelectedSchool(null);
            form.reset({
                name: "",
                slug: "",
                address: "",
                phone: "",
                logoUrl: "",
            });
        }
    };


    const columns: Column<School>[] = [
        { header: "Name", accessorKey: "name", className: "font-medium", sortable: true },
        { header: "Slug", accessorKey: "slug", sortable: true },
        { header: "Address", accessorKey: "address", sortable: true },
        { header: "Phone", accessorKey: "phone", sortable: true },
        {
            header: "Status", cell: (school) => (
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={school.is_active}
                        onCheckedChange={() => toggleStatus(school)}
                    />
                    <span className="text-sm text-muted-foreground">
                        {school.is_active ? "Active" : "Blocked"}
                    </span>
                </div>
            )
        },
        {
            header: "Actions", cell: (school) => (
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openAdminDialog(school)} title="Manage Admin">
                        <ShieldCheck className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(school)} title="Edit School">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => openDeleteAlert(school)} title="Delete School">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
            </div>

            <Tabs defaultValue="schools">
                <TabsList>
                    <TabsTrigger value="schools">Schools</TabsTrigger>

                </TabsList>

                <TabsContent value="schools" className="space-y-4">
                    <div className="flex justify-end">
                        <Dialog open={open} onOpenChange={handleDialogChange}>
                            <DialogTrigger asChild>
                                <Button><Plus className="mr-2 h-4 w-4" /> Add School</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{isEditing ? "Edit School" : "Add New School"}</DialogTitle>
                                </DialogHeader>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>School Name</FormLabel>
                                                    <FormControl><Input {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="slug"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Slug (Subdomain)</FormLabel>
                                                    <FormControl><Input {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Address</FormLabel>
                                                    <FormControl><Input {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Phone</FormLabel>
                                                    <FormControl><Input {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="features.attendance"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                    <div className="space-y-0.5">
                                                        <FormLabel>Enable Attendance (Pro)</FormLabel>
                                                        <div className="text-[0.8rem] text-muted-foreground">
                                                            Allow this school to track student attendance.
                                                        </div>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="features.transport"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                    <div className="space-y-0.5">
                                                        <FormLabel>Enable Transport (Pro)</FormLabel>
                                                        <div className="text-[0.8rem] text-muted-foreground">
                                                            Allow this school to manage transport routes and fees.
                                                        </div>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                            {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            {isEditing ? "Update School" : "Create School"}
                                        </Button>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Schools</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable columns={columns} data={schools} searchKey="name" />
                        </CardContent>
                    </Card>
                </TabsContent>


            </Tabs>

            <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Admin for {selectedSchool?.name}</DialogTitle>
                    </DialogHeader>
                    <Form {...adminForm}>
                        <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                            <FormField
                                control={adminForm.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Admin Email</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={adminForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={adminForm.formState.isSubmitting}>
                                {adminForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Update Credentials
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete <b>{selectedSchool?.name}</b> and all associated data (students, teachers, fees, etc.).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
