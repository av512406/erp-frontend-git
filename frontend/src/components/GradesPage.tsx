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
import { useToast } from "@/hooks/use-toast";

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
  saving?: boolean;
}

const TERMS = ['Term 1', 'Term 2', 'Final'];

export default function GradesPage({ students, grades, onSaveGrades, saving = false }: GradesPageProps) {
  const { toast } = useToast();
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [classSubjects, setClassSubjects] = useState<{ id: string; code: string; name: string; maxMarks?: number | null }[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [maxMarks, setMaxMarks] = useState<number>(100);

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

  // update maxMarks when subject selection changes
  useEffect(() => {
    if (!selectedSubject) return;
    const subj = classSubjects.find(s => s.name === selectedSubject);
    setMaxMarks(subj?.maxMarks ?? 100);
  }, [selectedSubject, classSubjects]);

  // keep section consistent with selected class
  useEffect(() => {
    if (selectedSection && !uniqueSectionsForClass.includes(selectedSection)) {
      setSelectedSection("");
    }
  }, [uniqueSectionsForClass, selectedSection]);

  // Load subjects for selected class
  useEffect(() => {
    setSelectedSubject("");
    if (!selectedGrade) { setClassSubjects([]); return; }
    (async () => {
      setLoadingSubjects(true);
      try {
        const res = await fetch(`/api/classes/${encodeURIComponent(selectedGrade)}/subjects`);
        if (res.ok) {
          const data: { id:string; code:string; name:string; maxMarks?: number | null }[] = await res.json();
          setClassSubjects(data);
        } else {
          setClassSubjects([]);
        }
      } catch {
        setClassSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    })();
  }, [selectedGrade]);

  const filteredStudents = students.filter(
    s => s.grade === selectedGrade && s.section === selectedSection
  );

  const handleMarksChange = (studentId: string, value: string) => {
    setGradeInputs(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSave = () => {
    // Only include students where the user has entered a non-empty mark
    const newGrades: GradeEntry[] = [];
    const skippedOverMax: string[] = [];
    for (const student of filteredStudents) {
      const raw = gradeInputs[student.id];
      if (raw === undefined || raw === '') continue; // skip empty
      const marks = parseFloat(raw);
      if (!isFinite(marks)) continue; // skip invalid numbers
      if (marks > (maxMarks || 100)) {
        skippedOverMax.push(student.admissionNumber);
        continue;
      }
      newGrades.push({ studentId: student.id, subject: selectedSubject, marks, term: selectedTerm });
    }

    if (newGrades.length === 0) {
      // nothing to save — inform the user
      toast({
        title: 'No marks to save',
        description: 'Enter marks for at least one student before saving.',
        variant: 'destructive',
      });
      return;
    }

    onSaveGrades(newGrades);
    setGradeInputs({});

    if (skippedOverMax.length) {
      toast({ title: 'Some marks were skipped', description: `Skipped ${skippedOverMax.length} entries above max (${maxMarks}).`, variant: 'destructive' });
    }
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
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedGrade || loadingSubjects}>
                <SelectTrigger id="subject" data-testid="select-subject">
                  <SelectValue placeholder={loadingSubjects ? "Loading subjects..." : (selectedGrade ? "Select subject" : "Select class first")} />
                </SelectTrigger>
                <SelectContent>
                  {classSubjects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No subjects configured for this class</div>
                  ) : (
                    classSubjects.map(subj => (
                      <SelectItem key={subj.id} value={subj.name}>{subj.name}</SelectItem>
                    ))
                  )}
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
        {selectedSubject ? (
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="w-40">
                <Label htmlFor="max-marks">Max Marks</Label>
                <Input id="max-marks" type="number" min={1} value={String(maxMarks)} onChange={(e) => setMaxMarks(Number(e.target.value || 0))} />
              </div>
              <div>
                <Button onClick={async () => {
                  const subj = classSubjects.find(s => s.name === selectedSubject);
                  if (!subj) return toast({ title: 'Save failed', description: 'Subject not found', variant: 'destructive' });
                  try {
                    const res = await fetch(`/api/classes/${encodeURIComponent(selectedGrade)}/subjects/${encodeURIComponent(subj.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxMarks }) });
                    if (res.ok) {
                      const j = await res.json();
                      setClassSubjects(prev => prev.map(p => p.id === subj.id ? { ...p, maxMarks: j.maxMarks ?? null } : p));
                      toast({ title: 'Max marks updated', description: `Max marks set to ${j.maxMarks ?? '—'}` });
                    } else {
                      toast({ title: 'Save failed', description: 'Unable to update max marks', variant: 'destructive' });
                    }
                  } catch (e) {
                    toast({ title: 'Save failed', description: 'Network error', variant: 'destructive' });
                  }
                }} className="mt-6">Save Max</Button>
              </div>
            </div>
          </CardContent>
        ) : null}
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
              <Button onClick={handleSave} className="gap-2" data-testid="button-save-grades" disabled={saving}>
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Class Marks"}
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
                    <TableHead className="text-right">Marks (out of {maxMarks})</TableHead>
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
                              max={String(maxMarks)}
                              className="max-w-24 ml-auto"
                              value={gradeInputs[student.id] ?? (existingGrade ? existingGrade.marks.toString() : '')}
                              placeholder="0"
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
