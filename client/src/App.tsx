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
  const [students, setStudents] = useState<Student[]>([
    {
      id: '1',
      admissionNumber: 'STU001',
      name: 'John Doe',
      dateOfBirth: '2010-05-15',
      admissionDate: '2022-04-01',
      aadharNumber: '1234-5678-9012',
      penNumber: 'PEN001234',
      aaparId: 'AAP001',
      mobileNumber: '555-0101',
      address: '123 Main St, City, State',
      grade: '10',
      section: 'A',
      yearlyFeeAmount: '25000'
    },
    {
      id: '2',
      admissionNumber: 'STU002',
      name: 'Jane Smith',
      dateOfBirth: '2010-08-22',
      admissionDate: '2022-04-01',
      aadharNumber: '2345-6789-0123',
      penNumber: 'PEN001235',
      aaparId: 'AAP002',
      mobileNumber: '555-0102',
      address: '456 Oak Ave, City, State',
      grade: '10',
      section: 'A',
      yearlyFeeAmount: '25000'
    },
    {
      id: '3',
      admissionNumber: 'STU003',
      name: 'Bob Johnson',
      dateOfBirth: '2010-03-10',
      admissionDate: '2022-04-01',
      aadharNumber: '3456-7890-1234',
      penNumber: 'PEN001236',
      aaparId: 'AAP003',
      mobileNumber: '555-0103',
      address: '789 Elm St, City, State',
      grade: '10',
      section: 'B',
      yearlyFeeAmount: '25000'
    },
    {
      id: '4',
      admissionNumber: 'STU004',
      name: 'Alice Williams',
      dateOfBirth: '2011-11-30',
      admissionDate: '2023-04-01',
      aadharNumber: '4567-8901-2345',
      penNumber: 'PEN001237',
      aaparId: 'AAP004',
      mobileNumber: '555-0104',
      address: '321 Pine Rd, City, State',
      grade: '9',
      section: 'A',
      yearlyFeeAmount: '28000'
    },
    {
      id: '5',
      admissionNumber: 'STU005',
      name: 'Charlie Brown',
      dateOfBirth: '2009-07-18',
      admissionDate: '2021-04-01',
      aadharNumber: '5678-9012-3456',
      penNumber: 'PEN001238',
      aaparId: 'AAP005',
      mobileNumber: '555-0105',
      address: '654 Maple Dr, City, State',
      grade: '11',
      section: 'A',
      yearlyFeeAmount: '22000'
    }
  ]);

  const [transactions, setTransactions] = useState<FeeTransaction[]>([
    {
      id: '1',
      studentId: '1',
      studentName: 'John Doe',
      amount: 500,
      date: '2024-01-15',
      transactionId: 'TXN001234'
    },
    {
      id: '2',
      studentId: '2',
      studentName: 'Jane Smith',
      amount: 750,
      date: '2024-01-18',
      transactionId: 'TXN001235'
    }
  ]);

  const [grades, setGrades] = useState<GradeEntry[]>([
    { studentId: '1', subject: 'Mathematics', marks: 85, term: 'Term 1' },
    { studentId: '1', subject: 'Science', marks: 92, term: 'Term 1' },
    { studentId: '1', subject: 'English', marks: 78, term: 'Term 1' },
    { studentId: '2', subject: 'Mathematics', marks: 88, term: 'Term 1' },
    { studentId: '2', subject: 'Science', marks: 95, term: 'Term 1' },
  ]);

  const handleAddStudent = (student: Omit<Student, 'id'>) => {
    setStudents([...students, { ...student, id: Date.now().toString() }]);
  };

  const handleEditStudent = (id: string, student: Omit<Student, 'id'>) => {
    setStudents(students.map(s => s.id === id ? { ...student, id } : s));
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
  };

  const handleAddTransaction = (transaction: Omit<FeeTransaction, 'id' | 'transactionId'>) => {
    const newTransaction = {
      ...transaction,
      id: Date.now().toString(),
      transactionId: `TXN${Math.random().toString().slice(2, 8)}`
    };
    setTransactions([newTransaction, ...transactions]);
  };

  const handleSaveGrades = (newGrades: GradeEntry[]) => {
    const updatedGrades = [...grades];
    newGrades.forEach(newGrade => {
      const existingIndex = updatedGrades.findIndex(
        g => g.studentId === newGrade.studentId && 
             g.subject === newGrade.subject && 
             g.term === newGrade.term
      );
      if (existingIndex >= 0) {
        updatedGrades[existingIndex] = newGrade;
      } else {
        updatedGrades.push(newGrade);
      }
    });
    setGrades(updatedGrades);
  };

  const handleImportStudents = (importedStudents: Omit<Student, 'id'>[]) => {
    const newStudents = importedStudents.map((s, index) => ({
      ...s,
      id: (Date.now() + index).toString()
    }));
    setStudents([...students, ...newStudents]);
  };

  const handleImportGrades = (importedGrades: GradeEntry[]) => {
    setGrades([...grades, ...importedGrades]);
  };

  const stats = {
    totalStudents: students.length,
    pendingFees: 12500,
    gradesEntered: grades.length,
    avgAttendance: 94
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
          isReadOnly={user.role === 'teacher'}
        />
      </Route>
      {user.role === 'admin' && (
        <>
          <Route path="/fees">
            <FeesPage
              students={students}
              transactions={transactions}
              onAddTransaction={handleAddTransaction}
            />
          </Route>
          <Route path="/reports">
            <ReportsPage students={students} grades={grades} />
          </Route>
          <Route path="/data-tools">
            <DataToolsPage
              students={students}
              onImportStudents={handleImportStudents}
              onImportGrades={handleImportGrades}
            />
          </Route>
        </>
      )}
      <Route path="/grades">
        <GradesPage
          students={students}
          grades={grades}
          onSaveGrades={handleSaveGrades}
        />
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
