import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import LoginPage from "@/components/LoginPage";
import Navigation from "@/components/Navigation";
import Dashboard from "@/components/Dashboard";
import StudentsPage from "@/components/StudentsPage";
import WithdrawnStudentsPage from "@/components/WithdrawnStudentsPage";
import FeesPage from "@/components/FeesPage";
import GradesPage from "@/components/GradesPage";
import ReportsPage from "@/components/ReportsPage";
import DataToolsPage from "@/components/DataToolsPage";
import SubjectsPage from "@/components/SubjectsPage";
import AdminSettingsPage from "./components/AdminSettingsPage";
import type { Student } from "@shared/schema";
import type { FeeTransaction } from "@/components/FeesPage";
import type { GradeEntry } from "@/components/GradesPage";

const AUTH_TOKEN_KEY = 'erpAuthToken';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'teacher';
  name?: string | null;
}

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function Router({ user, authFetch }: { user: User; authFetch: AuthFetch }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [withdrawnStudents, setWithdrawnStudents] = useState<Student[]>([]);
  // initial load from backend
  useEffect(() => {
    (async () => {
      try {
        const activeRes = await authFetch('/api/students');
        if (activeRes.ok) {
          setStudents(await activeRes.json());
        }
        const leftRes = await authFetch('/api/students/withdrawn');
        if (leftRes.ok) {
          setWithdrawnStudents(await leftRes.json());
        }
      } catch (e) { /* ignore network */ }
    })();
  }, [authFetch]);

  const [transactions, setTransactions] = useState<FeeTransaction[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/fees');
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) { /* ignore */ }
    })();
  }, [authFetch]);

  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [savingGrades, setSavingGrades] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/grades');
        if (res.ok) {
          const data = await res.json();
          setGrades(data);
        }
      } catch (e) { /* ignore */ }
    })();
  }, [authFetch]);

  const handleAddStudent = async (student: Omit<Student, 'id'>) => {
    try {
      const res = await authFetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
      if (res.ok) {
        const created = await res.json();
        setStudents(prev => [...prev, created]);
      }
    } catch (e) { /* ignore */ }
  };

  const handleEditStudent = async (id: string, student: Omit<Student, 'id'>) => {
    // need admissionNumber for PUT endpoint
    const existing = students.find(s => s.id === id);
    if (!existing) return;
    try {
  const res = await authFetch(`/api/students/${encodeURIComponent(existing.admissionNumber)}` , { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
      if (res.ok) {
        const updated = await res.json();
        setStudents(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (e) { /* ignore */ }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
  const res = await authFetch(`/api/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) setStudents(prev => prev.filter(s => s.id !== id));
    } catch (e) { /* ignore */ }
  };

  const handleMarkWithdrawn = async (admissionNumber: string, payload: { leftDate?: string; reason?: string }) => {
    try {
      const body: { leftDate?: string; reason?: string } = {};
      if (payload.leftDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.leftDate)) {
        body.leftDate = payload.leftDate;
      }
      const trimmedReason = payload.reason?.trim();
      if (trimmedReason) {
        body.reason = trimmedReason;
      }
      // Prefer professional alias; fall back to legacy path if needed
      let res = await authFetch(`/api/students/${encodeURIComponent(admissionNumber)}/withdraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        res = await authFetch(`/api/students/${encodeURIComponent(admissionNumber)}/leave`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      if (!res.ok) {
        const msg = await (async () => { try { const j = await res.json(); return j?.message; } catch { return ''; } })();
        throw new Error(msg || 'Failed');
      }
      const updated = await res.json();
      setStudents(prev => prev.filter(s => s.admissionNumber !== admissionNumber));
      setWithdrawnStudents(prev => [...prev, updated]);
    } catch (e) {
      // surface minimal alert
      alert((e as any)?.message || 'Failed to mark as withdrawn');
    }
  };

  const handleAddTransaction = async (transaction: Omit<FeeTransaction, 'id' | 'transactionId'>) => {
    const res = await authFetch('/api/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: transaction.studentId,
        amount: String(transaction.amount),
        paymentDate: transaction.date,
        paymentMode: transaction.paymentMode || 'cash',
        remarks: transaction.remarks || ''
      })
    });
    if (!res.ok) {
      const msg = await (async () => { try { const j = await res.json(); return j?.message || 'Failed to record payment'; } catch { return 'Failed to record payment'; } })();
      throw new Error(msg);
    }
    const created = await res.json();
    setTransactions(prev => [created, ...prev]);
    return created as FeeTransaction;
  };
  const handleSaveGrades = async (newGrades: GradeEntry[]) => {
    setSavingGrades(true);
    try {
      // Some DB/validation layers expect numeric/decimal fields as strings
      // (see server/schema). Send marks as strings to avoid Zod/Drizzle parsing errors.
      const payloadToSend = newGrades.map(g => ({ ...g, marks: String(g.marks) }));

  const res = await authFetch('/api/grades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadToSend) });
      if (res.ok) {
        const payload = await res.json();
        if (Array.isArray(payload.grades)) {
          // merge: replace existing rows with same (studentId, subject, term) or append
          setGrades(prev => {
            const key = (g: GradeEntry) => `${g.studentId}::${g.subject}::${g.term}`;
            const incomingMap = new Map<string, GradeEntry>();
            payload.grades.forEach((g: GradeEntry) => incomingMap.set(key(g), g));
            const merged = prev.filter(g => !incomingMap.has(key(g)));
            incomingMap.forEach(g => merged.push(g));
            return merged;
          });
        } else {
          // fallback full refresh
          const refreshed = await authFetch('/api/grades').then(r => r.json());
          setGrades(refreshed);
        }
        toast({
          title: "Grades saved successfully",
          description: `Updated ${payload.updated || 0} grade entries.`,
        });
      } else {
        toast({
          title: "Failed to save grades",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error saving grades",
        description: "Network error occurred.",
        variant: "destructive",
      });
    } finally {
      setSavingGrades(false);
    }
  };

  const handleImportStudents = async (imported: Omit<Student, 'id'>[]) => {
    try {
  const res = await authFetch('/api/students/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students: imported, strategy: 'skip' }) });
      if (res.ok) {
        const summary = await res.json();
  const refreshed = await authFetch('/api/students').then(r => r.json());
        setStudents(refreshed);
        return { added: summary.added, skipped: summary.skipped, skippedAdmissionNumbers: summary.skippedAdmissionNumbers };
      }
    } catch (e) { /* ignore */ }
    return { added: 0, skipped: 0, skippedAdmissionNumbers: [] };
  };

  const handleUpsertStudents = async (imported: Omit<Student, 'id'>[]) => {
    try {
  const res = await authFetch('/api/students/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students: imported, strategy: 'upsert' }) });
      if (res.ok) {
        const summary = await res.json();
  const refreshed = await authFetch('/api/students').then(r => r.json());
        setStudents(refreshed);
        return { updated: summary.updated };
      }
    } catch (e) { /* ignore */ }
    return { updated: 0 };
  };

  const handleImportGrades = async (imported: GradeEntry[]) => {
    await handleSaveGrades(imported);
  };

  const handleImportTransactions = async (imported: { studentId: string; amount: string; paymentDate: string; paymentMode?: string; remarks?: string }[]) => {
    try {
  const res = await authFetch('/api/fees/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(imported) });
      if (res.ok) {
        const summary = await res.json();
  const refreshed = await authFetch('/api/fees').then(r => r.json());
        setTransactions(refreshed);
        return { inserted: summary.inserted, skipped: summary.skipped, skippedRows: summary.skippedRows || [] };
      }
    } catch (e) { /* ignore */ }
    return { inserted: 0, skipped: 0, skippedRows: [] };
  };

  const handleLoadDemoData = (count = 50) => {
    // Generate demo students across grades 1-12 and sections A-C
    const gradesList = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
    const sections = ['A', 'B', 'C'];
    const demoStudents: Student[] = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const grade = gradesList[i % gradesList.length];
      const section = sections[i % sections.length];
      const admissionNumber = `S${new Date().getFullYear().toString().slice(-2)}-${String(i + 1).padStart(4, '0')}`;
      demoStudents.push({
        id: `${now}-${i}`,
        admissionNumber,
        name: `Student ${i + 1}`,
        dateOfBirth: '2012-01-01',
        admissionDate: new Date().toISOString().split('T')[0],
        aadharNumber: '',
        penNumber: '',
        aaparId: '',
        mobileNumber: '',
        address: '',
        grade,
        section,
        fatherName: '',
        motherName: '',
        yearlyFeeAmount: (20000 + (parseInt(grade) * 1000)).toString(),
        status: 'active',
        leftDate: '',
        leavingReason: ''
      });
    }

    // simple demo transactions: a few payments per some students
    const demoTransactions: any[] = [];
    for (let i = 0; i < Math.min(80, count * 2); i++) {
      const stu = demoStudents[i % demoStudents.length];
      demoTransactions.push({
        id: `t-${now}-${i}`,
        studentId: stu.id,
        studentName: stu.name,
        amount: Math.floor(500 + Math.random() * 5000),
        date: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 180)).toISOString().split('T')[0],
        transactionId: `EX-${String(i + 1).padStart(6, '0')}`
      });
    }

    // demo grades: random marks for some students
    const demoGrades: GradeEntry[] = [];
    const subjects = ['Mathematics', 'Science', 'English', 'History', 'Geography'];
    const terms = ['Term 1', 'Term 2', 'Final'];
    for (let i = 0; i < Math.min(200, count * subjects.length); i++) {
      const stu = demoStudents[i % demoStudents.length];
      demoGrades.push({
        studentId: stu.id,
        subject: subjects[i % subjects.length],
        marks: Math.floor(40 + Math.random() * 60),
        term: terms[i % terms.length]
      });
    }

    setStudents(demoStudents);
    setTransactions(demoTransactions as any);
    setGrades(demoGrades);
  };

  const stats = {
    totalStudents: students.length,
    pendingFees: (() => {
      const totalYearly = students.reduce((s, st) => s + (parseFloat(st.yearlyFeeAmount || '0') || 0), 0);
      const paid = transactions.reduce((s, t) => s + (t.amount || 0), 0);
      return Math.max(Math.round(totalYearly - paid), 0);
    })(),
    gradesEntered: grades.length,
    avgAttendance: 95,
  };

  return (
    <Switch>
      <Route path="/">
        <Dashboard stats={stats} userRole={user.role} />
      </Route>
      <Route path="/students">
        <StudentsPage
          students={students}
          onAddStudent={handleAddStudent}
          onEditStudent={handleEditStudent}
          onDeleteStudent={handleDeleteStudent}
          onMarkWithdrawn={handleMarkWithdrawn}
        />
      </Route>
      <Route path="/students-withdrawn">
        <WithdrawnStudentsPage students={withdrawnStudents} onRestore={async (admissionNumber) => {
          try {
            const res = await authFetch(`/api/students/${encodeURIComponent(admissionNumber)}/restore`, { method: 'PUT' });
            if (!res.ok) {
              const msg = await (async () => { try { const j = await res.json(); return j?.message; } catch { return ''; } })();
              throw new Error(msg || 'Failed to restore');
            }
            const restored = await res.json();
            setWithdrawnStudents(prev => prev.filter(s => s.admissionNumber !== admissionNumber));
            setStudents(prev => [...prev, restored]);
          } catch (e: any) {
            alert(e?.message || 'Restore failed');
          }
        }} />
      </Route>
      <Route path="/students-left">
        <WithdrawnStudentsPage students={withdrawnStudents} onRestore={async (admissionNumber) => {
          try {
            const res = await authFetch(`/api/students/${encodeURIComponent(admissionNumber)}/restore`, { method: 'PUT' });
            if (!res.ok) {
              const msg = await (async () => { try { const j = await res.json(); return j?.message; } catch { return ''; } })();
              throw new Error(msg || 'Failed to restore');
            }
            const restored = await res.json();
            setWithdrawnStudents(prev => prev.filter(s => s.admissionNumber !== admissionNumber));
            setStudents(prev => [...prev, restored]);
          } catch (e: any) {
            alert(e?.message || 'Restore failed');
          }
        }} />
      </Route>
      <Route path="/fees">
        <FeesPage
          students={students}
          transactions={transactions}
          onAddTransaction={handleAddTransaction}
        />
      </Route>
      <Route path="/data-tools">
        <DataToolsPage
          students={students}
          onImportStudents={handleImportStudents}
          onUpsertStudents={handleUpsertStudents}
          onImportGrades={handleImportGrades}
          onImportTransactions={handleImportTransactions}
        />
      </Route>
      <Route path="/subjects">
        <SubjectsPage students={students} />
      </Route>
      <Route path="/grades">
        <GradesPage
          students={students}
          grades={grades}
          onSaveGrades={handleSaveGrades}
          saving={savingGrades}
        />
      </Route>
      <Route path="/reports">
        <ReportsPage students={students} grades={grades} />
      </Route>
      <Route path="/admin-settings">
        <AdminSettingsPage />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  });
  const [initializingAuth, setInitializingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUser(null);
      setInitializingAuth(false);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error('Session expired');
        }
        const payload = await res.json();
        if (!cancelled) {
          setUser(payload?.user ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(AUTH_TOKEN_KEY);
          }
        }
      } finally {
        if (!cancelled) {
          setInitializingAuth(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
      setUser(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
    return response;
  }, [token]);

  const handleLogin = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const msg = await (async () => { try { const payload = await res.json(); return payload?.message; } catch { return ''; } })();
      throw new Error(msg || 'Invalid credentials');
    }
    const payload = await res.json();
    const nextUser = payload?.user;
    const nextToken = payload?.token;
    if (!nextUser || !nextToken) {
      throw new Error('Malformed auth response');
    }
    setUser(nextUser);
    setToken(nextToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    }
    setInitializingAuth(false);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  };

  if (initializingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Connecting to server…
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoginPage onLogin={handleLogin} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Navigation userRole={user.role} userEmail={user.email} onLogout={handleLogout} />
          <Router user={user} authFetch={authFetch} />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
