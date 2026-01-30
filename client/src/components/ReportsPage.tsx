
import { useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "@/lib/auth";
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
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { REPORT_TEMPLATES } from '@/lib/documentTemplates';

interface ReportsPageProps {
  students: Student[];
  grades: GradeEntry[];
}

export default function ReportsPage({ students, grades }: ReportsPageProps) {
  const { config } = useSchoolConfig();
  const TERMS = config.examPattern || ['Term 1', 'Term 2', 'Final'];
  const { data: customTemplate } = useDocumentTemplate('report_card');
  const [selectedTemplateId, setSelectedTemplateId] = useState('default');

  // Load default from config
  useEffect(() => {
    if (config.features && config.features.report_card_template) {
      setSelectedTemplateId(config.features.report_card_template as string);
    }
  }, [config]);

  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [studentPage, setStudentPage] = useState(0);
  const PAGE_SIZE = 50;
  const [isStudentSelectOpen, setIsStudentSelectOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetch('/api/classes/grades', { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : [])
      .then(data => setAvailableGrades(data))
      .catch(() => setAvailableGrades([]));
  }, []);

  useEffect(() => {
    setAvailableSections([]);
    if (!selectedClass || selectedClass === 'all') return;

    fetch(`/api/classes/${encodeURIComponent(selectedClass)}/sections`, { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : [])
      .then(data => setAvailableSections(data))
      .catch(() => setAvailableSections([]));
  }, [selectedClass]);

  const handleGenerate = () => {
    setShowReport(true);
  };

  const calculateGrade = (marks: number) => {
    if (marks >= 91) return 'A1';
    if (marks >= 81) return 'A2';
    if (marks >= 71) return 'B1';
    if (marks >= 61) return 'B2';
    if (marks >= 51) return 'C1';
    if (marks >= 41) return 'C2';
    if (marks >= 33) return 'D';
    return 'E';
  };

  const student = students.find(s => s.id === selectedStudent);
  const [classSubjects, setClassSubjects] = useState<string[]>([]);
  useEffect(() => {
    if (!student) { setClassSubjects([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/classes/${encodeURIComponent(student.grade)}/subjects`, { headers: getAuthHeaders() });
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

  const getReportHtml = () => {
    if (!student) return '';

    // Data Preparation
    const logoSection = schoolConfig.logoUrl ? `<img src="${schoolConfig.logoUrl}" alt="Logo" class="logo" style="height: 60px;" />` : '';
    const dateStr = new Date().toLocaleDateString();

    const rowsHtml = reportRows.map((row, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${row.subject}</td>
        <td style="text-align: right;">100</td>
        <td style="text-align: right;">${row.marks ?? '-'}</td>
      </tr>
    `).join('');

    const rowsSimple = reportRows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${row.subject}</td>
        <td>100</td>
        <td>${row.marks ?? '-'}</td>
        <td>${row.marks && row.marks >= 35 ? 'Pass' : 'Fail'}</td>
      </tr>
    `).join('');

    const rowsModern = reportRows.map((row, index) => `
      <tr>
        <td class="sub-col" style="text-align: left; padding-left: 10px;">${row.subject}</td>
        <td>100</td>
        <td>${row.marks ?? '-'}</td>
        <td>${calculateGrade(row.marks ?? 0)}</td>
      </tr>
    `).join('');

    const gradesTableDPS = `
      <table>
        <thead>
            <tr>
                <th colspan="3">Academic Performance</th>
            </tr>
            <tr>
                <th style="min-width: 150px; text-align: left; padding-left: 10px;">SUBJECTS</th>
                <th>MARKS OBTAINED (100)</th>
                <th>GRADE</th>
            </tr>
        </thead>
        <tbody>
          ${reportRows.map(row => `
            <tr>
                <td class="left-align" style="text-align: left; padding-left: 10px;">${row.subject}</td>
                <td>${row.marks ?? '-'}</td>
                <td>${calculateGrade(row.marks ?? 0)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background-color: #f8f9fa;">
             <td class="left-align" style="text-align: left; padding-left: 10px;">Total</td>
             <td>${reportRows.reduce((sum, row) => sum + (row.marks || 0), 0)}</td>
             <td>-</td>
          </tr>
          <tr style="font-weight: bold; background-color: #e9ecef;">
             <td class="left-align" style="text-align: left; padding-left: 10px;">Percentage</td>
             <td>${(() => {
        const total = reportRows.reduce((sum, row) => sum + (row.marks || 0), 0);
        const max = reportRows.length * 100;
        return max > 0 ? ((total / max) * 100).toFixed(2) : '0';
      })()}%</td>
             <td>-</td>
          </tr>
        </tfoot>
      </table>
    `;

    // Calculate Consolidated Data
    const consolidatedRows = classSubjects.map(sub => {
      let totalMarks = 0;
      let count = 0;
      const termMarks: Record<string, string | number> = {};

      TERMS.forEach(term => {
        const g = grades.find(g => g.studentId === student.id && g.subject === sub && g.term === term);
        if (g && g.marks !== undefined) {
          termMarks[term] = g.marks;
          totalMarks += g.marks;
          count++;
        } else {
          termMarks[term] = '-';
        }
      });

      return {
        subject: sub,
        termMarks,
        total: totalMarks,
        grade: count > 0 ? calculateGrade(totalMarks / count) : '-'
      };
    });

    const gradesTableConsolidated = `
      <table>
        <thead>
            <tr>
                <th colspan="${TERMS.length + 2}">Academic Performance</th>
            </tr>
            <tr>
                <th style="min-width: 150px; text-align: left; padding-left: 10px;">SUBJECTS</th>
                ${TERMS.map(t => `<th>${t.toUpperCase()}</th>`).join('')}
                <th>TOTAL</th>
            </tr>
        </thead>
        <tbody>
          ${consolidatedRows.map(row => `
            <tr>
                <td class="left-align" style="text-align: left; padding-left: 10px;">${row.subject}</td>
                ${TERMS.map(t => `<td>${row.termMarks[t]}</td>`).join('')}
                <td>${row.total}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background-color: #f8f9fa;">
             <td class="left-align" style="text-align: left; padding-left: 10px;">Total</td>
             ${TERMS.map(term => {
      const termTotal = consolidatedRows.reduce((sum, row) => sum + (typeof row.termMarks[term] === 'number' ? (row.termMarks[term] as number) : 0), 0);
      return `<td>${termTotal}</td>`;
    }).join('')}
             <td>${consolidatedRows.reduce((sum, row) => sum + row.total, 0)}</td>
          </tr>
          <tr style="font-weight: bold; background-color: #e9ecef;">
             <td class="left-align" style="text-align: left; padding-left: 10px;">Percentage</td>
             ${TERMS.map(term => {
      const termTotal = consolidatedRows.reduce((sum, row) => sum + (typeof row.termMarks[term] === 'number' ? (row.termMarks[term] as number) : 0), 0);
      const termMax = consolidatedRows.length * 100;
      return `<td>${termMax > 0 ? ((termTotal / termMax) * 100).toFixed(2) : '0'}%</td>`;
    }).join('')}
             <td>${(() => {
        const grandTotal = consolidatedRows.reduce((sum, row) => sum + row.total, 0);
        const grandMax = consolidatedRows.length * TERMS.length * 100;
        return grandMax > 0 ? ((grandTotal / grandMax) * 100).toFixed(2) : '0';
      })()}%</td>
          </tr>
        </tfoot>
      </table>
    `;

    let templateContent = '';

    // 1. Custom DB Template (Highest Priority)
    if (customTemplate) {
      templateContent = customTemplate.content;
    }
    // 2. Selected System Template
    else {
      const sysTemplate = REPORT_TEMPLATES.find(t => t.id === selectedTemplateId) || REPORT_TEMPLATES[0];
      templateContent = sysTemplate.content;
    }

    const gradesTable = `
      <table>
        <thead>
          <tr>
            <th>Sr. No.</th>
            <th>Subject</th>
            <th>Max Marks</th>
            <th>Marks Obtained</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          ${reportRows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td style="text-align: left;">${row.subject}</td>
              <td>100</td>
              <td>${row.marks ?? '-'}</td>
              <td>${calculateGrade(row.marks ?? 0)}</td>
            </tr>
          `).join('')}
             <tr style="font-weight: bold; background-color: #f8f9fa;">
            <td colspan="2" style="text-align: right;">Total</td>
            <td>${reportRows.length * 100}</td>
            <td>${total}</td>
            <td>${average}%</td>
          </tr>
        </tbody>
      </table>
    `;

    // Replacements
    let html = templateContent;
    html = html.replace(/{{term}}/g, selectedTerm);
    html = html.replace(/{{session}}/g, schoolConfig.session);
    html = html.replace(/{{schoolName}}/g, schoolConfig.name);
    html = html.replace(/{{schoolAddress}}/g, schoolConfig.address);
    html = html.replace(/{{schoolPhone}}/g, schoolConfig.phone);
    html = html.replace(/{{schoolEmail}}/g, schoolConfig.email);
    html = html.replace(/{{logoSection}}/g, logoSection);

    html = html.replace(/{{studentName}}/g, student.name);
    html = html.replace(/{{admissionNumber}}/g, student.admissionNumber);
    html = html.replace(/{{grade}}/g, student.grade);
    html = html.replace(/{{section}}/g, student.section);
    html = html.replace(/{{fatherName}}/g, student.fatherName || '-');
    html = html.replace(/{{motherName}}/g, student.motherName || '-');
    html = html.replace(/{{dob}}/g, student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '-');
    html = html.replace(/{{rollNo}}/g, (student as any).rollNumber || '-');
    html = html.replace(/{{rollNumber}}/g, (student as any).rollNumber || '-');

    html = html.replace(/{{gradesTableDPS}}/g, gradesTableDPS);
    html = html.replace(/{{gradesTableConsolidated}}/g, gradesTableConsolidated);
    html = html.replace(/{{gradesTable}}/g, gradesTable);
    html = html.replace(/{{rows}}/g, rowsHtml);
    html = html.replace(/{{rowsSimple}}/g, rowsSimple);
    html = html.replace(/{{rowsModern}}/g, rowsModern);

    html = html.replace(/{{totalMax}}/g, (reportRows.length * 100).toString());
    html = html.replace(/{{totalObtained}}/g, total.toString());
    html = html.replace(/{{percentage}}/g, average);
    html = html.replace(/{{printDate}}/g, dateStr);

    return `
      <html>
        <head>
          <title>Report Card - ${student.name}</title>
          <style>
            @page { size: A4; margin: 0; }
            /* Force A4 size and clear margins */
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
            
            /* Inject Template Styles */
            ${customTemplate?.styles || (REPORT_TEMPLATES.find(t => t.id === selectedTemplateId)?.styles || '')}
            
            /* Debug/Fallback Styles if template styles missing */
            .report-card, .classic-report, .dps-report { width: 100%; min-height: 297mm; box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    if (!student) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(getReportHtml());
    printWindow.document.close();
    printWindow.focus();
    // Allow images to load before print (basic delay)
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const [previewHtml, setPreviewHtml] = useState('');

  // Update preview when template or data changes if report is shown
  useEffect(() => {
    if (showReport && student) {
      setPreviewHtml(getReportHtml());
    }
  }, [showReport, student, selectedTerm, selectedTemplateId, classSubjects, grades]);

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
                  {availableGrades.map(c => (
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
                  {availableSections.map(sec => (
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

          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-select">Report Template (Override Default)</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger id="template-select" className="w-[300px]">
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TEMPLATES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {
        showReport && student && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between print:hidden">
              <CardTitle>Report Card Preview</CardTitle>
              <Button onClick={handlePrint} className="gap-2" data-testid="button-print-report">
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="w-full h-[800px] border rounded-md overflow-hidden bg-gray-100 flex justify-center p-4">
                <iframe
                  title="Report Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full bg-white shadow-lg"
                  style={{ maxWidth: '210mm', height: '100%', border: 'none' }}
                />
              </div>
            </CardContent>
          </Card>
        )
      }
    </div >
  );
}
