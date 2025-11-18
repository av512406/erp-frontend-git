import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/components/LoginPage";
import Navigation from "@/components/Navigation";
import Dashboard from "@/components/Dashboard";
import StudentsPage from "@/components/StudentsPage";
import FeesPage from "@/components/FeesPage";
import GradesPage from "@/components/GradesPage";
import ReportsPage from "@/components/ReportsPage";
import DataToolsPage from "@/components/DataToolsPage";
import type { Student } from "@shared/schema";
import type { FeeTransaction } from "@/components/FeesPage";
import type { GradeEntry } from "@/components/GradesPage";

interface User {
  email: string;
  role: 'admin' | 'teacher';
}

function Router({ user }: { user: User }) {
  const [, setLocation] = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  // initial load from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/students');
        if (res.ok) {
          const data = await res.json();
          setStudents(data);
        }
      } catch (e) { /* network error ignored */ }
    })();
  }, []);

  const [transactions, setTransactions] = useState<FeeTransaction[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/fees');
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const [grades, setGrades] = useState<GradeEntry[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/grades');
        if (res.ok) {
          const data = await res.json();
          setGrades(data);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const handleAddStudent = async (student: Omit<Student, 'id'>) => {
    try {
      const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
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
      const res = await fetch(`/api/students/${encodeURIComponent(existing.admissionNumber)}` , { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
      if (res.ok) {
        const updated = await res.json();
        setStudents(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (e) { /* ignore */ }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) setStudents(prev => prev.filter(s => s.id !== id));
    } catch (e) { /* ignore */ }
  };

  const handleAddTransaction = async (transaction: Omit<FeeTransaction, 'id' | 'transactionId'>) => {
    try {
      const res = await fetch('/api/fees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        studentId: transaction.studentId,
        amount: transaction.amount,
        paymentDate: transaction.date,
        paymentMode: transaction.paymentMode || 'cash',
        remarks: transaction.remarks || ''
      }) });
      if (res.ok) {
        const created = await res.json();
        setTransactions(prev => [created, ...prev]);
        return created as FeeTransaction;
      }
    } catch (e) { /* ignore */ }
    // fallback optimistic local object
    const optimistic: FeeTransaction = {
      id: Date.now().toString(),
      studentId: transaction.studentId,
      studentName: transaction.studentName,
      amount: transaction.amount,
      date: transaction.date,
      transactionId: 'TEMP' + Math.random().toString().slice(2,8),
      paymentMode: transaction.paymentMode || 'cash',
      remarks: transaction.remarks || ''
    };
    setTransactions(prev => [optimistic, ...prev]);
    return optimistic;
  };
  const handleSaveGrades = async (newGrades: GradeEntry[]) => {
    try {
      const res = await fetch('/api/grades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newGrades) });
      if (res.ok) {
        // refresh grades from server
        const refreshed = await fetch('/api/grades').then(r => r.json());
        setGrades(refreshed);
      }
    } catch (e) { /* ignore */ }
  };

  const handleImportStudents = async (imported: Omit<Student, 'id'>[]) => {
    try {
      const res = await fetch('/api/students/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students: imported, strategy: 'skip' }) });
      if (res.ok) {
        const summary = await res.json();
        const refreshed = await fetch('/api/students').then(r => r.json());
        setStudents(refreshed);
        return { added: summary.added, skipped: summary.skipped, skippedAdmissionNumbers: summary.skippedAdmissionNumbers };
      }
    } catch (e) { /* ignore */ }
    return { added: 0, skipped: 0, skippedAdmissionNumbers: [] };
  };

  const handleUpsertStudents = async (imported: Omit<Student, 'id'>[]) => {
    try {
      const res = await fetch('/api/students/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students: imported, strategy: 'upsert' }) });
      if (res.ok) {
        const summary = await res.json();
        const refreshed = await fetch('/api/students').then(r => r.json());
        setStudents(refreshed);
        return { updated: summary.updated };
      }
    } catch (e) { /* ignore */ }
    return { updated: 0 };
  };

  const handleImportGrades = async (imported: GradeEntry[]) => {
    await handleSaveGrades(imported);
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
        yearlyFeeAmount: (20000 + (parseInt(grade) * 1000)).toString()
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
        />
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
        />
      </Route>
      <Route path="/grades">
        <GradesPage
          students={students}
          grades={grades}
          onSaveGrades={handleSaveGrades}
        />
      </Route>
      <Route path="/reports">
        <ReportsPage students={students} grades={grades} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (email: string, password: string) => {
    if (email === 'admin@school.edu' && password === 'admin123') {
      setUser({ email, role: 'admin' });
    } else if (email === 'teacher@school.edu' && password === 'teacher123') {
      setUser({ email, role: 'teacher' });
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

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
          <Router user={user} />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
