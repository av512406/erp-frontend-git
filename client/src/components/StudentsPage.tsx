import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, Column } from "@/components/ui/data-table";
import { Plus, Pencil, Trash2, Search, UserX, Eye, GraduationCap } from "lucide-react";
import StudentFormModal from "./StudentFormModal";
import StudentViewModal from "./StudentViewModal";
import PromoteStudentModal from "./PromoteStudentModal";
import type { Student, InsertStudent } from "@shared/schema";

interface StudentsPageProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onEditStudent: (id: string, student: Omit<Student, 'id'>) => void;
  onDeleteStudent: (id: string) => void;
  onMarkWithdrawn?: (admissionNumber: string, payload: { leftDate?: string; reason?: string }) => Promise<void> | void;
  isReadOnly?: boolean;
  sessions?: { id: string, name: string }[];
  selectedSessionId?: string;
  onStudentPromoted?: () => void;
}

export default function StudentsPage({
  students,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onMarkWithdrawn,
  isReadOnly = false,
  sessions = [],
  selectedSessionId,
  onStudentPromoted
}: StudentsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // derive unique grades and sections for filter dropdowns
  const uniqueGrades = Array.from(new Set(students.map(s => s.grade))).sort((a, b) => parseInt(a) - parseInt(b));
  const uniqueSections = Array.from(new Set(students.map(s => s.section))).sort();

  const filteredStudents = students.filter(student => {
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

  const handleSave = (studentData: Omit<Student, 'id'>) => {
    if (editingStudent) {
      onEditStudent(editingStudent.id, studentData);
    } else {
      onAddStudent(studentData);
    }
    setIsModalOpen(false);
    setEditingStudent(null);
  };

  const openView = (student: Student) => {
    setViewingStudent(student);
    setIsViewOpen(true);
  };


  const columns: Column<Student>[] = [
    { header: "Admission No.", accessorKey: "admissionNumber", className: "font-mono", sortable: true },
    { header: "Name", accessorKey: "name", className: "font-medium", sortable: true },
    { header: "Class", accessorKey: "grade", sortable: true },
    { header: "Section", accessorKey: "section", sortable: true },
    { header: "Mobile", accessorKey: "mobileNumber", className: "font-mono" },
    { header: "Yearly Fee", cell: (s: Student) => `₹${(Number(s.yearlyFeeAmount) || 0).toLocaleString('en-IN')}` },
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
            onClick={() => onDeleteStudent(student.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {onMarkWithdrawn && student.status !== 'left' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const reason = window.prompt('Withdrawal reason (optional):', '');
                if (reason === null) return;
                try {
                  await onMarkWithdrawn(student.admissionNumber, { reason: reason || '' });
                } catch (e: any) {
                  alert(e?.message || 'Failed to mark student as withdrawn');
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
  ].filter(Boolean) as Column<Student>[];

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
                  <SelectItem key={g} value={g}>Class {g}</SelectItem>
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
                  <SelectItem key={s} value={s}>Section {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <DataTable columns={columns} data={filteredStudents} />
      </div>

      <StudentFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStudent(null);
        }}
        onSave={handleSave}
        student={editingStudent}
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
            if (onStudentPromoted) onStudentPromoted();
          }}
        />
      )}
    </div>
  );
}

