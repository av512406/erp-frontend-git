import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Printer } from "lucide-react";
import type { Student } from '@shared/schema';
import type { GradeEntry } from "./GradesPage";
import { schoolConfig } from '@/lib/schoolConfig';
import { useDocumentTemplate } from '@/hooks/useDocumentTemplate';
import { useSchoolConfig } from '@/hooks/useSchoolConfig'; // Assuming this hook exists

interface ReportsPageProps {
  students: Student[];
  grades: GradeEntry[];
}

const TERMS = ['Term 1', 'Term 2', 'Final'];

export default function ReportsPage({ students, grades }: ReportsPageProps) {
  const { config } = useSchoolConfig();
  const { data: template } = useDocumentTemplate('report_card');

  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [studentPage, setStudentPage] = useState(0);
  const PAGE_SIZE = 50;
  const [isStudentSelectOpen, setIsStudentSelectOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [showReport, setShowReport] = useState(false);

  const handleGenerate = () => {
    setShowReport(true);
  };



  const handlePrint = () => {
    if (!student) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const rowsHtml = reportRows.map((row, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${row.subject}</td>
        <td style="text-align: right;">100</td>
        <td style="text-align: right;">${row.marks ?? '-'}</td>
      </tr>
    `).join('');

    // Default Template Content
    const defaultContent = `
      <html>
        <head>
          <title>Report Card - ${student.name}</title>
          <style>
            body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; }
            @page { size: A4; margin: 10mm; }
            .container { 
                border: 2px solid #000; 
                padding: 20px; 
                width: 100%; 
                max-width: 210mm; 
                margin: 0 auto; 
                box-sizing: border-box; 
                min-height: 90vh; 
                display: flex; 
                flex-direction: column; 
            }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .header-content { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 5px; }
            .logo { height: 60px; object-fit: contain; }
            .school-info { text-align: center; }
            .school-name { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
            .school-address { font-size: 12px; font-style: italic; margin-top: 2px; }
            .contact-info { font-size: 11px; margin-top: 2px; }
            .report-title { 
                font-size: 18px; 
                font-weight: bold; 
                text-decoration: underline; 
                text-align: center; 
                margin: 15px 0; 
                text-transform: uppercase;
            }
            .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 13px; }
            .info-row { display: flex; }
            .info-label { font-weight: bold; width: 120px; }
            .info-value { font-weight: 500; }
            
            table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; border: 1px solid #000; }
            th { border: 1px solid #000; padding: 8px; background-color: #f3f3f3; text-align: left; }
            td { border: 1px solid #000; padding: 8px; }
            
            .footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 40px; }
            .signature { text-align: center; width: 150px; }
            .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; font-size: 12px; font-weight: bold; }
            
            @media print {
              body { margin: 0; -webkit-print-color-adjust: exact; }
              .container { border: 2px solid #000; height: 270mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
                <div class="header-content">
                    ${schoolConfig.logoUrl ? `<img src="${schoolConfig.logoUrl}" alt="Logo" class="logo" />` : ''}
                    <div class="school-info">
                        <div class="school-name">${schoolConfig.name}</div>
                        <div class="school-address">${schoolConfig.addressLine}</div>
                        <div class="contact-info">Phone: ${schoolConfig.phone} | Email: ${schoolConfig.email}</div>
                    </div>
                </div>
            </div>
            
            <div class="report-title">REPORT CARD - ${selectedTerm}</div>
            
            <div class="student-info">
                <div class="info-row"><span class="info-label">Student Name:</span> <span class="info-value">${student.name}</span></div>
                <div class="info-row"><span class="info-label">Admission No:</span> <span class="info-value">${student.admissionNumber}</span></div>
                <div class="info-row"><span class="info-label">Class/Section:</span> <span class="info-value">${student.grade} - ${student.section}</span></div>
                <div class="info-row"><span class="info-label">Session:</span> <span class="info-value">${schoolConfig.session}</span></div>
                <div class="info-row"><span class="info-label">Father's Name:</span> <span class="info-value">${student.fatherName || '-'}</span></div>
                <div class="info-row"><span class="info-label">Date of Birth:</span> <span class="info-value">${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '-'}</span></div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px; text-align: center;">S.No</th>
                        <th>Subject</th>
                        <th style="text-align: right; width: 100px;">Max Marks</th>
                        <th style="text-align: right; width: 100px;">Marks Obtained</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr style="font-weight: bold; background-color: #f9f9f9;">
                        <td colspan="2" style="text-align: right; padding-right: 20px;">Total</td>
                        <td style="text-align: right;">${reportRows.length * 100}</td>
                        <td style="text-align: right;">${total}</td>
                    </tr>
                    <tr style="font-weight: bold;">
                        <td colspan="2" style="text-align: right; padding-right: 20px;">Percentage</td>
                        <td colspan="2" style="text-align: center;">${average}%</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="footer">
                <div class="signature">
                    <div class="sign-line">Class Teacher</div>
                </div>
                <div class="signature">
                    <div class="sign-line">Principal</div>
                </div>
                <div class="signature">
                    <div class="sign-line">Parent</div>
                </div>
            </div>
          </div>
        </body>
      </html>
    `;

    if (template) {
      let html = template.content;
      // Basic replacements - extend as needed
      html = html.replace(/{{studentName}}/g, student.name);
      html = html.replace(/{{admissionNumber}}/g, student.admissionNumber);
      html = html.replace(/{{grade}}/g, student.grade);
      html = html.replace(/{{section}}/g, student.section);
      html = html.replace(/{{term}}/g, selectedTerm);
      html = html.replace(/{{rows}}/g, rowsHtml);
      html = html.replace(/{{total}}/g, total.toString());
      html = html.replace(/{{average}}/g, average);

      printWindow.document.write(html);
    } else {
      printWindow.document.write(defaultContent);
    }

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const student = students.find(s => s.id === selectedStudent);
  const [classSubjects, setClassSubjects] = useState<string[]>([]);
  useEffect(() => {
    if (!student) { setClassSubjects([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/classes/${encodeURIComponent(student.grade)}/subjects`);
        if (res.ok) {
          const data: { name: string }[] = await res.json();
          setClassSubjects(data.map(d => d.name));
        } else setClassSubjects([]);
      } catch {
        setClassSubjects([]);
      }
    })();
  }, [student]);

  const gradeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of grades) {
      if (g.studentId === selectedStudent && g.term === selectedTerm) {
        map.set(g.subject, g.marks);
      }
    }
    return map;
  }, [grades, selectedStudent, selectedTerm]);

  const reportRows = classSubjects.map(sub => ({ subject: sub, marks: gradeMap.get(sub) }));
  const total = reportRows.reduce((sum, r) => sum + (r.marks ?? 0), 0);
  const average = reportRows.length > 0 ? (total / reportRows.length).toFixed(2) : '0';

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Report Cards</h1>
        <p className="text-muted-foreground">Generate student report cards</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Student and Term</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection(''); setSelectedStudent(''); }}>
                <SelectTrigger id="class" data-testid="select-report-class">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {Array.from(new Set(students.map(s => s.grade))).sort((a, b) => parseInt(a) - parseInt(b)).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section">Section</Label>
              <Select value={selectedSection} onValueChange={(v) => { setSelectedSection(v); setSelectedStudent(''); }} disabled={!selectedClass}>
                <SelectTrigger id="section" data-testid="select-report-section">
                  <SelectValue placeholder={selectedClass ? "Select section" : "Select class first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {Array.from(new Set(students.filter(s => s.grade === selectedClass).map(s => s.section))).sort().map(sec => (
                    <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="student">Student</Label>
              <Select
                value={selectedStudent}
                onValueChange={(v) => {
                  if (v === '__LOAD_MORE__') {
                    setStudentPage(p => p + 1);
                    // reopen so user can continue selecting
                    setIsStudentSelectOpen(true);
                    return;
                  }
                  setSelectedStudent(v);
                  setIsStudentSelectOpen(false);
                }}
                disabled={!selectedClass || !selectedSection}
                open={isStudentSelectOpen}
                onOpenChange={(open) => {
                  setIsStudentSelectOpen(open);
                  if (open) {
                    // reset pagination/filter when opened
                    setStudentPage(0);
                    setStudentFilter('');
                  }
                }}
              >
                <SelectTrigger id="student" data-testid="select-report-student">
                  <SelectValue placeholder={(!selectedClass || selectedClass === 'all' || !selectedSection || selectedSection === 'all') ? "Select class & section first" : "Select student"} />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search student name or admission no..."
                      value={studentFilter}
                      onChange={(e) => { setStudentFilter(e.target.value); setStudentPage(0); }}
                      data-testid="input-student-search"
                    />
                  </div>
                  <div className="p-1">
                    {(() => {
                      const pool = students.filter(s => s.grade === selectedClass && s.section === selectedSection);
                      const filtered = pool.filter(s => {
                        const q = studentFilter.trim().toLowerCase();
                        if (!q) return true;
                        return s.name.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q);
                      });
                      const start = 0;
                      const end = (studentPage + 1) * PAGE_SIZE;
                      const pageItems = filtered.slice(start, end);
                      return (
                        <>
                          {pageItems.map(student => (
                            <SelectItem key={student.id} value={student.id}>{student.name} ({student.admissionNumber})</SelectItem>
                          ))}
                          {filtered.length > end && (
                            <SelectItem value="__LOAD_MORE__">Load more...</SelectItem>
                          )}
                          {filtered.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No students found</div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger id="term" data-testid="select-report-term">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map(term => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGenerate}
                disabled={!selectedStudent || !selectedTerm}
                className="w-full gap-2"
                data-testid="button-generate-report"
              >
                <FileText className="w-4 h-4" />
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showReport && student && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between print:hidden">
            <CardTitle>Report Card</CardTitle>
            <Button onClick={handlePrint} className="gap-2" data-testid="button-print-report">
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center border-b pb-4">
              <h1 className="text-2xl font-semibold">{schoolConfig.name}</h1>
              <p className="text-sm text-muted-foreground">Academic Report Card</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Student Name</p>
                <p className="font-semibold">{student.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Student ID</p>
                <p className="font-mono font-semibold">{student.admissionNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Class / Section</p>
                <p className="font-semibold">{student.grade} - {student.section}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Term</p>
                <p className="font-semibold">{selectedTerm}</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Marks Obtained</TableHead>
                    <TableHead className="text-right">Maximum Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No grades available for this term
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {reportRows.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{row.subject}</TableCell>
                          <TableCell className="text-right font-semibold">{row.marks ?? ''}</TableCell>
                          <TableCell className="text-right">100</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-bold">{total}</TableCell>
                        <TableCell className="text-right font-semibold">{reportRows.length * 100}</TableCell>
                      </TableRow>
                      <TableRow className="bg-primary/10">
                        <TableCell className="font-semibold">Average</TableCell>
                        <TableCell className="text-right font-bold text-primary">{average}%</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 border-t">
              <div className="text-center">
                <div className="border-t border-foreground/20 pt-2 mt-12">
                  <p className="text-sm text-muted-foreground">Class Teacher</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-foreground/20 pt-2 mt-12">
                  <p className="text-sm text-muted-foreground">Principal</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
