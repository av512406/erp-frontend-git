import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Download, Upload } from "lucide-react";
import type { Student } from "@shared/schema";

export interface GradeEntry {
  studentId: string;
  subject: string;
  marks: number;
  term: string;
}

interface GradesPageProps {
  students: Student[];
  grades: GradeEntry[];
  onSaveGrades: (grades: GradeEntry[]) => void;
}

const SUBJECTS = ['Mathematics', 'Science', 'English', 'History', 'Geography'];
const TERMS = ['Term 1', 'Term 2', 'Final'];

export default function GradesPage({ students, grades, onSaveGrades }: GradesPageProps) {
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});

  // derive unique classes and sections from provided students
  const uniqueClasses = useMemo(() => (
    Array.from(new Set(students.map(s => s.grade)))
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b))
  ), [students]);

  const uniqueSectionsForClass = useMemo(() => {
    const pool = selectedGrade ? students.filter(s => s.grade === selectedGrade) : students;
    return Array.from(new Set(pool.map(s => s.section))).filter(Boolean).sort();
  }, [students, selectedGrade]);

  // keep section consistent with selected class
  useEffect(() => {
    if (selectedSection && !uniqueSectionsForClass.includes(selectedSection)) {
      setSelectedSection("");
    }
  }, [uniqueSectionsForClass, selectedSection]);

  const filteredStudents = students.filter(
    s => s.grade === selectedGrade && s.section === selectedSection
  );

  const handleMarksChange = (studentId: string, value: string) => {
    setGradeInputs(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSave = () => {
    const newGrades: GradeEntry[] = filteredStudents.map(student => ({
      studentId: student.id,
      subject: selectedSubject,
      marks: parseFloat(gradeInputs[student.id] || '0'),
      term: selectedTerm
    }));
    onSaveGrades(newGrades);
    setGradeInputs({});
  };

  // CSV template download
  const handleDownloadTemplate = () => {
    // CSV headers (human-friendly): Admission Number, Name, Class, Section, Subject, Term, Marks
    // Prefill Class/Section/Subject/Term for clarity; Marks left blank
    const header = ['Admission Number', 'Name', 'Class', 'Section', 'Subject', 'Term', 'Marks'];
    const csvRows = filteredStudents.map(s => [
      s.admissionNumber,
      `"${s.name.replace(/"/g, '""')}"`,
      selectedGrade,
      selectedSection,
      selectedSubject,
      selectedTerm,
      ''
    ].join(','));
    const csv = [header.join(',')]
      .concat(csvRows)
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
  a.download = `${selectedGrade || 'class'}-${selectedSection || 'section'}-${selectedSubject || 'subject'}-${selectedTerm || 'term'}-marks-template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Import CSV and call onSaveGrades
  const handleImportFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      // normalize headers: remove spaces and lowercase to match tokens like
      // admissionnumber, name, class, section, subject, term, marks
      const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
      const admIndex = header.indexOf('admissionnumber');
      const marksIndex = header.indexOf('marks');
      const subjectIndex = header.indexOf('subject');
      const termIndex = header.indexOf('term');
      if (admIndex === -1 || marksIndex === -1) {
        window.alert('CSV must contain headers: Admission Number, Name, Class, Section, Subject, Term, Marks');
        return;
      }
      const parsed: GradeEntry[] = [];
      const skipped: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const admissionNumber = cols[admIndex]?.replace(/"/g, '').trim();
        const marksStr = (cols[marksIndex] || '').trim();
        const csvSubject = subjectIndex !== -1 ? (cols[subjectIndex] || '').trim() : '';
        const csvTerm = termIndex !== -1 ? (cols[termIndex] || '').trim() : '';
        if (!admissionNumber) continue;
        // Use current filter scope; template is generated for filtered students
        const student = filteredStudents.find(s => s.admissionNumber === admissionNumber);
        if (!student) {
          skipped.push(admissionNumber);
          continue;
        }
        const marks = parseFloat(marksStr || '0');
        parsed.push({
          studentId: student.id,
          subject: csvSubject || selectedSubject,
          term: csvTerm || selectedTerm,
          marks,
        });
      }
      if (parsed.length > 0) {
        onSaveGrades(parsed);
        window.alert(`Imported ${parsed.length} records${skipped.length ? `, skipped ${skipped.length} unknown admission numbers` : ''}.`);
      } else {
        window.alert('No valid records found to import.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const isReadyToEnter = selectedGrade && selectedSection && selectedSubject && selectedTerm;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Class Entry</h1>
        <p className="text-muted-foreground">Enter and manage student marks</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grade">Class</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger id="grade" data-testid="select-grade">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueClasses.map(cls => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedGrade}>
                <SelectTrigger id="section" data-testid="select-section">
                  <SelectValue placeholder={selectedGrade ? "Select section" : "Select class first"} />
                </SelectTrigger>
                <SelectContent>
                  {uniqueSectionsForClass.map(section => (
                    <SelectItem key={section} value={section}>{section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger id="subject" data-testid="select-subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map(subject => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger id="term" data-testid="select-term">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map(term => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isReadyToEnter ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Enter Marks - {selectedSubject} ({selectedTerm})</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2" data-testid="button-download-template">
                <Download className="w-4 h-4" />
                Download Template
              </Button>
              {/* hidden file input for CSV import */}
              <input
                id="import-csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)}
              />
              <Button onClick={() => document.getElementById('import-csv-input')?.click()} className="gap-2" data-testid="button-import-csv">
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
              <Button onClick={handleSave} className="gap-2" data-testid="button-save-grades">
                <Save className="w-4 h-4" />
                Save Class Marks
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Marks (out of 100)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No students found for Class {selectedGrade} Section {selectedSection}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map(student => {
                      const existingGrade = grades.find(
                        g => g.studentId === student.id && 
                             g.subject === selectedSubject && 
                             g.term === selectedTerm
                      );
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono">{student.admissionNumber}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="max-w-24 ml-auto"
                              placeholder={existingGrade ? existingGrade.marks.toString() : "0"}
                              value={gradeInputs[student.id] || ''}
                              onChange={(e) => handleMarksChange(student.id, e.target.value)}
                              data-testid={`input-marks-${student.id}`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Please select Class, Section, Subject, and Term to enter marks
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
