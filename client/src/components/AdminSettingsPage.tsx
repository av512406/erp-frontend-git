import React, { useState, useEffect } from 'react';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { REPORT_TEMPLATES, TC_TEMPLATES } from '@/lib/documentTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Trash2, Plus, FileText } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
  created_at?: string;
}

// Pass currentUser to access the logged-in admin's domain
function UserManagement({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<User[]>([]);
  const { config } = useSchoolConfig();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'teacher'
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { headers: getAuthHeaders() });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      let finalUsername = formData.username;

      // Auto-append domain if missing
      if (!finalUsername.includes('@')) {
        // Use the logged-in admin's domain if available, otherwise config email, otherwise default
        let domain = 'school.com';
        if (currentUser && currentUser.username && currentUser.username.includes('@')) {
          domain = currentUser.username.split('@')[1];
        } else if (config.email && config.email.includes('@')) {
          domain = config.email.split('@')[1];
        }
        finalUsername = `${finalUsername}@${domain}`;
      }

      // Basic validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalUsername)) {
        toast({ title: "Validation Error", description: "Username must be in format username@schoolname.com", variant: "destructive" });
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...formData, username: finalUsername })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed');
      }

      toast({ title: "Success", description: `User ${editingUser ? 'updated' : 'created'} successfully` });
      setIsOpen(false);
      setEditingUser(null);
      setFormData({ username: '', password: '', name: '', role: 'teacher' });
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        toast({ title: "Success", description: "User deleted" });
        fetchUsers();
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '', // Don't show password
      name: user.name,
      role: user.role
    });
    setIsOpen(true);
  };


  const columns: Column<User>[] = [
    { header: "Name", accessorKey: "name", sortable: true },
    { header: "Username", accessorKey: "username", sortable: true },
    { header: "Role", accessorKey: "role", sortable: true, cell: (u) => <Badge variant="secondary" className="capitalize">{u.role}</Badge> },
    {
      header: "Actions", cell: (user) => (
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  const currentDomain = currentUser?.username?.split('@')[1] || config.email?.split('@')[1] || 'school.com';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Users</h3>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingUser(null);
            setFormData({ username: '', password: '', name: '', role: 'teacher' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    required
                    disabled={!!editingUser}
                    placeholder="jdoe"
                  />
                  {!editingUser && <span className="text-sm text-muted-foreground whitespace-nowrap">@{currentDomain}</span>}
                </div>
                {!editingUser && <p className="text-xs text-muted-foreground">Login will be username@{currentDomain}</p>}
              </div>
              <div className="space-y-2">
                <Label>Password {editingUser && '(Leave blank to keep current)'}</Label>
                <Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required={!editingUser} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">{editingUser ? 'Update' : 'Create'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md p-4">
        <DataTable columns={columns} data={users} searchKey="name" />
      </div>
    </div>
  );
}

const sessionSchema = z.object({
  name: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY (e.g. 2025-26)"),
  startDate: z.string().min(1, "Start Date is required"),
  endDate: z.string().min(1, "End Date is required"),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

function SessionManagement() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
    }
  });

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', { headers: getAuthHeaders() });
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const onSubmit = async (data: SessionFormValues) => {
    try {
      const url = editingSession ? `/api/sessions/${editingSession.id}` : '/api/sessions';
      const method = editingSession ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        toast({ title: "Success", description: `Session ${editingSession ? 'updated' : 'created'} successfully` });
        setIsOpen(false);
        setEditingSession(null);
        setEditingSession(null);
        form.reset({ name: "", startDate: "", endDate: "" });
        fetchSessions();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.message || "Operation failed", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        toast({ title: "Success", description: "Session deleted" });
        fetchSessions();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
  };


  const columns: Column<any>[] = [
    { header: "Name", accessorKey: "name", sortable: true },
    { header: "Start Date", cell: (s) => new Date(s.start_date).toLocaleDateString() },
    { header: "End Date", cell: (s) => new Date(s.end_date).toLocaleDateString() },
    {
      header: "Actions", cell: (s) => (
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => {
            setEditingSession(s);
            form.reset({
              name: s.name,
              startDate: new Date(s.start_date).toISOString().split('T')[0],
              endDate: new Date(s.end_date).toISOString().split('T')[0],
            });
            setIsOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Academic Sessions</h3>
        <Button onClick={() => {
          setEditingSession(null);
          setEditingSession(null);
          form.reset({ name: '', startDate: '', endDate: '' });
          setIsOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Create Session
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Edit Session' : 'Create Session'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Name</FormLabel>
                    <FormControl>
                      <Input placeholder="YYYY-YY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingSession ? 'Update Session' : 'Create Session'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="border rounded-md p-4">
        <DataTable columns={columns} data={sessions} searchKey="name" />
      </div>
    </div>
  );
}

function SchoolSettings() {
  const { config, isLoading, updateConfig, isSaving } = useSchoolConfig();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: config.name,
    address: config.address,
    phone: config.phone,
    email: config.email,
    logoFile: null as File | null
  });

  const [logoError, setLogoError] = useState<string | null>(null);
  const [examPattern, setExamPattern] = useState<string[]>([]);

  // Sync form with config when config loads
  useEffect(() => {
    setForm(f => ({
      ...f,
      name: config.name,
      address: config.address,
      phone: config.phone,
      email: config.email,
    }));
    setExamPattern(config.examPattern || ["Term 1", "Term 2", "Final"]);
  }, [config]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const { name, value, files } = e.target;
    if (name === 'logoFile' && files) {
      const file = files[0];
      if (file) {
        if (file.size > 300 * 1024) {
          setLogoError('Logo too large. Please use an image under 300KB.');
          setForm(f => ({ ...f, logoFile: null }));
        } else {
          setLogoError(null);
          setForm(f => ({ ...f, logoFile: file }));
        }
      }
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig({ ...form, examPattern });
      toast({ title: "Success", description: "School settings updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update settings", variant: "destructive" });
    }
  };



  const addExamTerm = () => {
    setExamPattern([...examPattern, `Term ${examPattern.length + 1}`]);
  };

  const removeExamTerm = (index: number) => {
    setExamPattern(examPattern.filter((_, i) => i !== index));
  };

  const updateExamTerm = (index: number, value: string) => {
    const newPattern = [...examPattern];
    newPattern[index] = value;
    setExamPattern(newPattern);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>School Information</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isLoading && <p className="text-sm text-muted-foreground">Loading current configuration...</p>}
            <div className="space-y-2">
              <Label htmlFor="name">School Name</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" value={form.address} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" value={form.email} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoFile">Logo Image (optional)</Label>
              <Input id="logoFile" name="logoFile" type="file" accept="image/*" onChange={handleChange} />
              {config.logoUrl && <img src={config.logoUrl} alt="Current Logo" className="h-20 mt-2 object-contain border rounded" />}
              {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
              {!logoError && form.logoFile && <p className="text-xs text-muted-foreground mt-1">Selected: {form.logoFile.name} ({Math.round(form.logoFile.size / 1024)} KB)</p>}
            </div>

            <div className="space-y-2">
              <Label>Exam Configuration</Label>
              <div className="space-y-2 border p-4 rounded-md">
                {examPattern.map((term, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={term}
                      onChange={(e) => updateExamTerm(index, e.target.value)}
                      placeholder={`Term ${index + 1}`}
                    />
                    <Button type="button" variant="destructive" size="icon" onClick={() => removeExamTerm(index)}>
                      <span className="sr-only">Remove</span>
                      &times;
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addExamTerm}>Add Exam Term</Button>
              </div>
              <p className="text-xs text-muted-foreground">Define the exam terms for your school (e.g., Term 1, Term 2, Final).</p>
            </div>

            <div className="text-xs text-muted-foreground">Updating settings immediately affects receipts and other areas using school metadata.</div>
          </CardContent>
          <CardFooter className="flex flex-col items-end gap-2">
            <Button type="submit" disabled={isSaving || !config.id}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            {!config.id && !isLoading && (
              <p className="text-xs text-destructive">
                Error: School ID not loaded. Please refresh the page.
              </p>
            )}
          </CardFooter>
        </form>
      </Card >
    </div >
  );
}

function DocumentSettings() {
  const { config, updateConfig, isSaving, isLoading } = useSchoolConfig();
  const { toast } = useToast();

  const [reportTemplate, setReportTemplate] = useState('default');


  useEffect(() => {
    if (config.features) {
      setReportTemplate((config.features.report_card_template as string) || 'default');

    }
  }, [config]);

  const handleSave = async () => {
    try {
      const newFeatures = {
        ...config.features,
        report_card_template: reportTemplate,

      };
      await updateConfig({ ...config, features: newFeatures });
      toast({ title: "Success", description: "Document templates updated" });
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to update templates", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" /> Document Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Report Card Format</Label>
          <Select value={reportTemplate} onValueChange={setReportTemplate}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TEMPLATES.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">Select the layout for student report cards.</p>
        </div>


      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AdminSettingsPage({ currentUser }: { currentUser?: any }) {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Admin Settings</h2>
      <Tabs defaultValue="school">
        <TabsList className="mb-4">
          <TabsTrigger value="school">School Settings</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="sessions">Academic Sessions</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>
        <TabsContent value="school">
          <SchoolSettings />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentSettings />
        </TabsContent>
        <TabsContent value="sessions">
          <SessionManagement />
        </TabsContent>
        <TabsContent value="users">
          <UserManagement currentUser={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}