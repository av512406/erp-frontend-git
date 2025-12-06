import React, { useState, useEffect } from 'react';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
  created_at?: string;
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(formData)
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
                  {!editingUser && <span className="text-sm text-muted-foreground whitespace-nowrap">@schoolname.com (auto-appended if omitted)</span>}
                </div>
                {!editingUser && <p className="text-xs text-muted-foreground">Login will be username@schoolname.com</p>}
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

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell className="capitalize">{user.role}</TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(user)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">No users found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
    session: config.session,
    logoFile: null as File | null
  });

  const [logoError, setLogoError] = useState<string | null>(null);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [switchOpen, setSwitchOpen] = useState(false);
  const [examPattern, setExamPattern] = useState<string[]>([]);

  // Sync form with config when config loads
  useEffect(() => {
    setForm(f => ({
      ...f,
      name: config.name,
      address: config.address,
      phone: config.phone,
      session: config.session
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

  useEffect(() => {
    fetch('/api/sessions')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch sessions');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableSessions(data);
        } else {
          setAvailableSessions([]);
        }
      })
      .catch(err => {
        console.error(err);
        setAvailableSessions([]);
      });
  }, []);

  const handleSwitchSession = async () => {
    if (!selectedSession) return;
    try {
      const res = await fetch('/api/schools/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession })
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Session Switched", description: `Promoted ${data.promotedStudents} students.` });
        setSwitchOpen(false);
        window.location.reload();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to switch session.");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
              <Label>Current Session</Label>
              <div className="flex items-center gap-4">
                <div className="border px-3 py-2 rounded-md bg-muted min-w-[200px]">{config.session || 'Loading...'}</div>
                <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Switch Session</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Switch Academic Session</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Select New Session</Label>
                        <Select onValueChange={setSelectedSession}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select session" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSessions.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded border border-yellow-200">
                        <strong>Warning:</strong> Switching sessions will automatically promote all active students to the new session.
                      </div>
                      <Button onClick={handleSwitchSession} disabled={!selectedSession} className="w-full">
                        Confirm Switch
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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
      </Card>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Admin Settings</h2>
      <Tabs defaultValue="school">
        <TabsList className="mb-4">
          <TabsTrigger value="school">School Settings</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>
        <TabsContent value="school">
          <SchoolSettings />
        </TabsContent>
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}