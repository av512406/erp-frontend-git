import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, UserX, Eye } from "lucide-react";
import StudentFormModal from "./StudentFormModal";
import StudentViewModal from "./StudentViewModal";
import type { Student, InsertStudent } from "@shared/schema";

interface StudentsPageProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onEditStudent: (id: string, student: Omit<Student, 'id'>) => void;
  onDeleteStudent: (id: string) => void;
  onMarkWithdrawn?: (admissionNumber: string, payload: { leftDate?: string; reason?: string }) => Promise<void> | void;
  isReadOnly?: boolean;
}

export default function StudentsPage({
  students,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onMarkWithdrawn,
  isReadOnly = false
}: StudentsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

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
          <Button onClick={handleAdd} className="gap-2" data-testid="button-add-student">
            <Plus className="w-4 h-4" />
            Add Student
          </Button>
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Yearly Fee</TableHead>
              {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                  <TableCell colSpan={isReadOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                  <TableCell className="font-mono">{student.admissionNumber}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.grade}</TableCell>
                  <TableCell>{student.section}</TableCell>
                  <TableCell className="font-mono text-sm">{student.mobileNumber}</TableCell>
                  <TableCell>₹{(Number(student.yearlyFeeAmount) || 0).toLocaleString('en-IN')}</TableCell>
                  {!isReadOnly && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openView(student)}
                          title="View Details"
                          data-testid={`button-view-${student.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(student)}
                          data-testid={`button-edit-${student.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteStudent(student.id)}
                          data-testid={`button-delete-${student.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {onMarkWithdrawn && student.status !== 'left' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const reason = window.prompt('Withdrawal reason (optional):', '');
                              // If user cancels prompt (returns null), abort without withdrawing
                              if (reason === null) return;
                              const trimmedReason = reason.trim();
                              try {
                                await onMarkWithdrawn(
                                  student.admissionNumber,
                                  trimmedReason ? { reason: trimmedReason } : {}
                                );
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
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
    </div>
  );
}

