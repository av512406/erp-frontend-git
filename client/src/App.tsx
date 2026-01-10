import { useState, useEffect } from "react";
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
import SuperAdminDashboard from "@/components/SuperAdminDashboard";

import type { Student } from "@shared/schema";
import type { FeeTransaction } from "@/components/FeesPage";
import type { GradeEntry } from "@/components/GradesPage";
import { setToken, clearToken, getAuthHeaders } from "./lib/auth";

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
  email?: string; // compatibility
}

interface ProtectedRouteProps {
  allowedRoles: string[];
  userRole: string;
  children: React.ReactNode;
}

function ProtectedRoute({ allowedRoles, userRole, children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!allowedRoles.includes(userRole)) {
      setLocation("/");
    }
  }, [allowedRoles, userRole, setLocation]);

  if (!allowedRoles.includes(userRole)) {
    return null;
  }

  return <>{children}</>;
}

interface RouterProps {
  user: User;
  sessions: { id: string; name: string }[];
  selectedSessionId: string;
}

function Router({ user, sessions, selectedSessionId }: RouterProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [withdrawnStudents, setWithdrawnStudents] = useState<Student[]>([]);

  // Fetch students when selectedSessionId changes
  useEffect(() => {
    (async () => {
      if (!selectedSessionId) return;
      try {
        const activeRes = await fetch(`/api/students?sessionId=${selectedSessionId}`, { headers: getAuthHeaders() });
        if (activeRes.ok) {
          setStudents(await activeRes.json());
        }
        // Withdrawn students might be session-independent or dependent. 
        // For now, keeping original logic or we could filter by date/session too?
        // Let's assume withdrawn list is global for now, or use the existing endpoint.
        const leftRes = await fetch('/api/students/withdrawn', { headers: getAuthHeaders() });
        if (leftRes.ok) {
          setWithdrawnStudents(await leftRes.json());
        }
      } catch (e) { /* ignore network */ }
    })();
  }, [selectedSessionId]);

  const [transactions, setTransactions] = useState<FeeTransaction[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/fees', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [savingGrades, setSavingGrades] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/grades', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setGrades(data);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const handleAddStudent = async (student: Omit<Student, 'id'>) => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(student)
      });
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
      const res = await fetch(`/api/students/${encodeURIComponent(existing.admissionNumber)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(student)
      });
      if (res.ok) {
        const updated = await res.json();
        setStudents(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (e) { /* ignore */ }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) setStudents(prev => prev.filter(s => s.id !== id));
    } catch (e) { /* ignore */ }
  };

  const handleMarkWithdrawn = async (admissionNumber: string, payload: { leftDate?: string; reason?: string }) => {
    try {
      // Prefer professional alias; fall back to legacy path if needed
      let res = await fetch(`/api/students/${encodeURIComponent(admissionNumber)}/withdraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ leftDate: payload.leftDate, reason: payload.reason })
      });
      if (!res.ok) {
        res = await fetch(`/api/students/${encodeURIComponent(admissionNumber)}/leave`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ leftDate: payload.leftDate, reason: payload.reason })
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
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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

  const handleCancelTransaction = async (id: string, reason: string) => {
    const res = await fetch(`/api/fees/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const msg = await (async () => { try { const j = await res.json(); return j?.message; } catch { return 'Failed to cancel'; } })();
      throw new Error(msg);
    }
    const result = await res.json();
    // Update local state - merge changes to preserve camelCase fields (studentName etc)
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled', cancelReason: reason } : t));
  };

  const handleSaveGrades = async (newGrades: GradeEntry[]) => {
    setSavingGrades(true);
    try {
      // Some DB/validation layers expect numeric/decimal fields as strings
      // (see server/schema). Send marks as strings to avoid Zod/Drizzle parsing errors.
      const payloadToSend = newGrades.map(g => ({ ...g, marks: String(g.marks) }));

      const res = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payloadToSend)
      });
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
          const refreshed = await fetch('/api/grades', { headers: getAuthHeaders() }).then(r => r.json());
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

  const handleImportStudents = async (imported: Omit<Student, 'id'>[], targetSessionId?: string) => {
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ students: imported, strategy: 'skip', targetSessionId: targetSessionId === 'default' ? undefined : targetSessionId })
      });
      if (res.ok) {
        const summary = await res.json();
        const refreshed = await fetch('/api/students', { headers: getAuthHeaders() }).then(r => r.json());
        setStudents(refreshed);
        return { added: summary.added, skipped: summary.skipped, skippedAdmissionNumbers: summary.skippedAdmissionNumbers };
      }
    } catch (e) { /* ignore */ }
    return { added: 0, skipped: 0, skippedAdmissionNumbers: [] };
  };

  const handleUpsertStudents = async (imported: Omit<Student, 'id'>[]) => {
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ students: imported, strategy: 'upsert' })
      });
      if (res.ok) {
        const summary = await res.json();
        const refreshed = await fetch('/api/students', { headers: getAuthHeaders() }).then(r => r.json());
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
      const res = await fetch('/api/fees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(imported)
      });
      if (res.ok) {
        const summary = await res.json();
        const refreshed = await fetch('/api/fees', { headers: getAuthHeaders() }).then(r => r.json());
        setTransactions(refreshed);
        return { inserted: summary.inserted, skipped: summary.skipped, skippedRows: summary.skippedRows || [] };
      }
    } catch (e) { /* ignore */ }
    return { inserted: 0, skipped: 0, skippedRows: [] };
  };

  const refetchStudents = async () => {
    if (!selectedSessionId) return;
    try {
      const activeRes = await fetch(`/api/students?sessionId=${selectedSessionId}`, { headers: getAuthHeaders() });
      if (activeRes.ok) {
        setStudents(await activeRes.json());
      }
    } catch (e) { /* ignore */ }
  };

  const stats = {
    totalStudents: students.length,
    pendingFees: (() => {
      const totalYearly = students.reduce((s, st) => s + (parseFloat(st.yearlyFeeAmount || '0') || 0) + (parseFloat((st as any).previousYearDue || '0') || 0), 0);
      const paid = transactions
        .filter(t => t.status !== 'cancelled')
        .reduce((s, t) => s + (t.amount || 0), 0);
      return Math.max(Math.round(totalYearly - paid), 0);
    })(),
    feesCollectedToday: (() => {
      // Use local date string YYYY-MM-DD
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return transactions
        .filter(t => t.date && t.date.substring(0, 10) === today && t.status !== 'cancelled')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    })(),
    gradesEntered: grades.length,
    avgAttendance: 95,
  };

  return (
    <Switch>
      <Route path="/">
        <Dashboard stats={stats} userRole={user.role as any} />
      </Route>
      <Route path="/students">
        <ProtectedRoute allowedRoles={['admin']} userRole={user.role}>
          <StudentsPage
            students={students}
            onAddStudent={handleAddStudent}
            onEditStudent={handleEditStudent}
            onDeleteStudent={handleDeleteStudent}
            onMarkWithdrawn={handleMarkWithdrawn}
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onStudentPromoted={refetchStudents}
          />
        </ProtectedRoute>
      </Route>
      <Route path="/students-withdrawn">
        <ProtectedRoute allowedRoles={['admin']} userRole={user.role}>
          <WithdrawnStudentsPage students={withdrawnStudents} onRestore={async (admissionNumber) => {
            try {
              const res = await fetch(`/api/students/${encodeURIComponent(admissionNumber)}/restore`, {
                method: 'PUT',
                headers: getAuthHeaders()
              });
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
        </ProtectedRoute>
      </Route>
      <Route path="/students-left">
        <ProtectedRoute allowedRoles={['admin']} userRole={user.role}>
          <WithdrawnStudentsPage students={withdrawnStudents} onRestore={async (admissionNumber) => {
            try {
              const res = await fetch(`/api/students/${encodeURIComponent(admissionNumber)}/restore`, {
                method: 'PUT',
                headers: getAuthHeaders()
              });
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
        </ProtectedRoute>
      </Route>
      <Route path="/fees">
        <ProtectedRoute allowedRoles={['admin', 'accountant']} userRole={user.role}>
          <FeesPage
            students={students}
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onCancelTransaction={handleCancelTransaction}
          />
        </ProtectedRoute>
      </Route>
      <Route path="/data-tools">
        <ProtectedRoute allowedRoles={['admin']} userRole={user.role}>
          <DataToolsPage
            students={students}
            onImportStudents={handleImportStudents}
            onUpsertStudents={handleUpsertStudents}
            onImportGrades={handleImportGrades}
            onImportTransactions={handleImportTransactions}
            sessions={sessions}
            selectedSessionId={selectedSessionId}
          />
        </ProtectedRoute>
      </Route>
      <Route path="/subjects">
        <ProtectedRoute allowedRoles={['admin']} userRole={user.role}>
          <SubjectsPage students={students} />
        </ProtectedRoute>
      </Route>
      <Route path="/grades">
        {/* Grades accessible to both */}
        <GradesPage
          students={students}
          grades={grades}
          onSaveGrades={handleSaveGrades}
          saving={savingGrades}
        />
      </Route>
      <Route path="/reports">
        <ProtectedRoute allowedRoles={['admin']} userRole={user.role}>
          <ReportsPage students={students} grades={grades} />
        </ProtectedRoute>
      </Route>
      <Route path="/admin-settings">
        <ProtectedRoute allowedRoles={['admin']} userRole={user.role}>
          <AdminSettingsPage />
        </ProtectedRoute>
      </Route>

      <Route path="/super-admin">
        <ProtectedRoute allowedRoles={['superadmin']} userRole={user.role}>
          <SuperAdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string>("");
  const [, setLocation] = useLocation();

  // Session state
  const [sessions, setSessions] = useState<{ id: string, name: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Check for existing token on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/me', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setUser({ ...data.user, email: data.user.username });
        } else {
          // Token invalid or expired
          clearToken();
        }
      } catch (e) {
        clearToken();
      }
    };
    checkAuth();
  }, []);

  // Fetch sessions when user is logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/sessions', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
          // Set default to latest session (by end date or just last added if end_date not available/reliable)
          // Ideally sort by end_date desc
          if (data.length > 0 && !selectedSessionId) {
            const sorted = [...data].sort((a: any, b: any) => {
              // Use local info or string compare if date not present, but schema has dates.
              return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
            });
            setSelectedSessionId(sorted[0].id);
          }
        }
      } catch (e) { }
    })();
  }, [user]);

  const handleLogin = async (email: string, password: string) => {
    setLoginError(""); // clear previous errors
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token); // Store token
        setUser({ ...data.user, email: data.user.username });
      } else {
        let msg = "Invalid credentials";
        try {
          const errorData = await res.json();
          msg = errorData.message || msg;
        } catch (e) {
          // response was not JSON (e.g. 502 HTML), keep default or use status text
          msg = res.statusText || "Server error";
        }
        setLoginError(msg);
        toast({
          title: "Login failed",
          description: msg,
          variant: "destructive"
        });
      }
    } catch (e) {
      setLoginError("Network error. Please try again.");
      toast({
        title: "Login error",
        description: "Network error",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    clearToken(); // Clear token
    setUser(null);
    setSessions([]);
    setSelectedSessionId('');
    setLoginError("");
    setLocation("/");
  };

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoginPage onLogin={handleLogin} errorMessage={loginError} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Navigation
            userRole={user.role}
            userEmail={user.email || ''}
            onLogout={handleLogout}
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSessionChange={setSelectedSessionId}
          />
          <Router user={user} sessions={sessions} selectedSessionId={selectedSessionId} />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
