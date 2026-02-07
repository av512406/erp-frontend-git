import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, Column } from "@/components/ui/data-table";
import { Plus, Pencil, Trash2, Search, UserX, Eye, GraduationCap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StudentFormModal from "./StudentFormModal";
import StudentViewModal from "./StudentViewModal";
import PromoteStudentModal from "./PromoteStudentModal";
import type { Student, ExtendedStudent } from "@/types";
import { getAuthHeaders, clearToken } from "@/lib/auth";
import { sortGrades } from "@/lib/utils";
import { useStudentMutations } from "@/hooks/use-student-mutations";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface StudentsPageProps {
  students: ExtendedStudent[]; // This prop comes from App.tsx which fetches 'students' via useQuery
  selectedSessionId?: string;
  isReadOnly?: boolean;
  sessions?: any[];
  userRole?: string;
}

export default function StudentsPage({
  students, // This is the 'all' list from parent. Used when filterGrade != 'all' ??? No, used when manualPagination is FALSE?
  // Actually, original logic uses 'activeData'. 'serverData' when paginated, 'students' when not?
  // Let's preserve original logic.
  isReadOnly = false,
  sessions = [],
  selectedSessionId,
  userRole
}: StudentsPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addStudent, updateStudent, deleteStudent, markWithdrawn } = useStudentMutations();

  // Existing State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Pagination State
  const [isServerPaginated, setIsServerPaginated] = useState(true);
  const [serverData, setServerData] = useState<Student[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Server Data
  useEffect(() => {
    // If we are filtering by Grade, we want to fetch ALL students for that class to enable client-side sorting.
    // Otherwise (Global view), we use server pagination.
    // Original logic: const isClassView = filterGrade !== 'all';
    // const effectiveLimit = isClassView ? 1000 : limit;

    // We only fetch if server paginated is ON.
    if (!isServerPaginated) return;

    const fetchPage = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        const effectiveLimit = (filterGrade !== 'all') ? 1000 : limit;

        params.append('page', page.toString());
        params.append('limit', effectiveLimit.toString());
        if (selectedSessionId) params.append('sessionId', selectedSessionId);

        if (filterGrade !== 'all') params.append('grade', filterGrade);
        if (filterSection !== 'all') params.append('section', filterSection);
        if (searchTerm) params.append('q', searchTerm);

        const headers: any = { 'Content-Type': 'application/json', ...getAuthHeaders() };

        const res = await fetch(`/api/students?${params.toString()}`, {
          headers
        });

        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setServerData(json.data);
            setServerTotal(json.meta.total);
          } else {
            setServerData(json);
            setServerTotal(json.length);
          }
        } else {
          if (res.status === 401) {
            clearToken();
            window.location.href = '/';
            return;
          }
          console.error("Fetch failed", res.status);
        }
      } catch (e) {
        console.error("Failed to fetch page", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPage();
  }, [isServerPaginated, page, limit, selectedSessionId, filterGrade, filterSection, searchTerm, refreshTrigger]);

  const handleConfirmDelete = async () => {
    if (studentToDelete) {
      try {
        await deleteStudent.mutateAsync(studentToDelete);
        setStudentToDelete(null);
        setRefreshTrigger(prev => prev + 1);
        toast({ title: "Student deleted successfully" });
      } catch (error: any) {
        toast({ title: "Failed to delete student", description: error.message, variant: "destructive" });
      }
    }
  };

  const activeData = isServerPaginated ? serverData : students;

  // Use props.students for unique filters to include everyone
  const uniqueGrades = sortGrades(Array.from(new Set(students.map(s => s.grade || ""))));
  const uniqueSections = Array.from(new Set(students.map(s => s.section || ""))).filter(Boolean).sort();

  const filteredStudents = (activeData || []).filter(student => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = q === '' || (
      student.name.toLowerCase().includes(q) ||
      student.admissionNumber.toLowerCase().includes(q)
    );
    const matchesGrade = filterGrade === 'all' ? true : student.grade === filterGrade;
    const matchesSection = filterSection === 'all' ? true : student.section === filterSection;
    return matchesSearch && matchesGrade && matchesSection;
  });

  const handleAdd = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleSave = async (studentData: Omit<Student, 'id'>) => {
    try {
      if (editingStudent) {
        await updateStudent.mutateAsync({ id: editingStudent.id, data: studentData });
        toast({ title: "Student updated successfully" });
      } else {
        await addStudent.mutateAsync(studentData);
        toast({ title: "Student added successfully" });
      }
      setIsModalOpen(false);
      setEditingStudent(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      toast({ title: "Operation failed", description: error.message, variant: "destructive" });
    }
  };

  const openView = (student: Student) => {
    setViewingStudent(student);
    setIsViewOpen(true);
  };

  const columns: Column<ExtendedStudent>[] = [
    { header: "Admission No.", accessorKey: "admissionNumber", className: "font-mono", sortable: true },
    { header: "Name", accessorKey: "name", className: "font-medium", sortable: true },
    { header: "Class", accessorKey: "grade", sortable: true },
    { header: "Section", accessorKey: "section", sortable: true },
    { header: "Mobile", accessorKey: "mobileNumber", className: "font-mono" },
    ...(userRole !== 'teacher' ? [{ header: "Yearly Fee", cell: (s: ExtendedStudent) => `₹${(Number(s.yearlyFeeAmount) || 0).toLocaleString('en-IN')}` }] : []),
    !isReadOnly && {
      header: "Actions",
      className: "text-right",
      cell: (student: Student) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openView(student)}
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(student)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStudentToDelete(student.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {student.status !== 'left' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const reason = window.prompt('Withdrawal reason (optional):', '');
                if (reason === null) return;
                try {
                  await markWithdrawn.mutateAsync({
                    admissionNumber: student.admissionNumber,
                    payload: { reason: reason || '' },
                    sessionId: selectedSessionId
                  });
                  toast({ title: "Student marked as withdrawn" });
                  setRefreshTrigger(prev => prev + 1);
                } catch (e: any) {
                  toast({ title: "Failed to mark student as withdrawn", description: e.message, variant: "destructive" });
                }
              }}
              title="Mark as Withdrawn"
            >
              <UserX className="w-4 h-4" />
            </Button>
          )}
        </div>
      )
    }
  ].filter(Boolean) as Column<ExtendedStudent>[];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-muted-foreground">
            {isReadOnly ? "View student information" : "Manage student records"}
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsPromoteOpen(true)} className="gap-2">
              <GraduationCap className="w-4 h-4" /> Import/Promote
            </Button>
            <Button onClick={handleAdd} className="gap-2" data-testid="button-add-student">
              <Plus className="w-4 h-4" />
              Add Student
            </Button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="search-students"
              name="search"
              placeholder="Search by name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-students"
            />
          </div>
          <div className="flex-1 md:max-w-xs">
            <Label htmlFor="filter-grade" className="text-xs font-medium">Filter by Class</Label>
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger id="filter-grade" className="mt-1">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {uniqueGrades.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 md:max-w-xs">
            <Label htmlFor="filter-section" className="text-xs font-medium">Filter by Section</Label>
            <Select value={filterSection} onValueChange={setFilterSection}>
              <SelectTrigger id="filter-section" className="mt-1">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {uniqueSections.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {(filterGrade !== 'all' || filterSection !== 'all' || searchTerm) && (
              <Button variant="ghost" onClick={() => { setFilterGrade('all'); setFilterSection('all'); setSearchTerm(''); }}>Reset</Button>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <DataTable
          columns={columns}
          data={filteredStudents}
          manualPagination={filterGrade === 'all' && isServerPaginated}
          totalRows={filterGrade === 'all' && isServerPaginated ? serverTotal : undefined}
          pageSize={limit}
          onPageChange={(p, l) => {
            setPage(p);
            setLimit(l);
          }}
          enablePaginationToggle={true}
          isPaginationEnabled={isServerPaginated}
          onPaginationToggle={setIsServerPaginated}
        />
      </div>

      <StudentFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStudent(null);
        }}
        onSave={handleSave}
        student={editingStudent}
        sessions={sessions}
        currentSessionId={selectedSessionId}
        userRole={userRole}
      />
      <StudentViewModal
        isOpen={isViewOpen}
        onClose={() => { setIsViewOpen(false); setViewingStudent(null); }}
        student={viewingStudent}
      />
      {selectedSessionId && (
        <PromoteStudentModal
          isOpen={isPromoteOpen}
          onClose={() => setIsPromoteOpen(false)}
          targetSessionId={selectedSessionId}
          sessions={sessions}
          onSuccess={() => {
            // Invalidate queries to refresh list
            queryClient.invalidateQueries({ queryKey: ['students'] });
            setRefreshTrigger(p => p + 1);
          }}
        />
      )}

      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the student and all associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
