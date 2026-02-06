
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, Upload, Printer } from "lucide-react";
import html2canvas from "html2canvas";
import { getAuthHeaders } from "@/lib/auth";
import type { Student } from "@shared/schema";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import Barcode from 'react-barcode';

interface IDCardPageProps {
    students: Student[];
}

export default function IDCardPage({ students }: IDCardPageProps) {
    const { config } = useSchoolConfig();
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedSection, setSelectedSection] = useState<string>("");
    const [selectedStudentId, setSelectedStudentId] = useState<string>("");
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [themeColor, setThemeColor] = useState<string>("#4a148c");

    // Color Options
    const THEMES = [
        { name: "Royal Purple", value: "#4a148c" },
        { name: "Classic Blue", value: "#1e40af" },
        { name: "Navy Blue", value: "#0f172a" },
        { name: "School Red", value: "#b91c1c" },
        { name: "Emerald Green", value: "#15803d" },
        { name: "Maroon", value: "#881337" },
    ];

    // Filters
    const [availableGrades, setAvailableGrades] = useState<string[]>([]);
    const [availableSections, setAvailableSections] = useState<string[]>([]);

    const cardRef = useRef<HTMLDivElement>(null);

    // Fetch Grades
    useEffect(() => {
        fetch('/api/classes/grades', { headers: getAuthHeaders() })
            .then(res => res.ok ? res.json() : [])
            .then(data => setAvailableGrades(data))
            .catch(() => setAvailableGrades([]));
    }, []);

    // Fetch Sections
    useEffect(() => {
        setAvailableSections([]);
        if (!selectedClass || selectedClass === 'all') return;

        fetch(`/api/classes/${encodeURIComponent(selectedClass)}/sections`, { headers: getAuthHeaders() })
            .then(res => res.ok ? res.json() : [])
            .then(data => setAvailableSections(data))
            .catch(() => setAvailableSections([]));
    }, [selectedClass]);

    const filteredStudents = students.filter(s => {
        return (!selectedClass || s.grade === selectedClass) &&
            (!selectedSection || s.section === selectedSection);
    });

    const selectedStudent = students.find(s => s.id === selectedStudentId);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPhotoUrl(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current || !selectedStudent) return;
        try {
            // Force scroll to top to prevent offset issues
            window.scrollTo(0, 0);

            const canvas = await html2canvas(cardRef.current, {
                scale: 4, // High resolution
                useCORS: true,
                backgroundColor: '#ffffff', // Force white background
                logging: false,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.querySelector('.id-card-container') as HTMLElement;
                    if (el) {
                        // Reset any potential transforms on the clone root
                        el.style.transform = 'none';
                        el.style.margin = '0';
                        el.style.boxShadow = 'none'; // Clean edges
                        el.style.fontFeatureSettings = '"liga" 0';
                        (el.style as any).webkitFontSmoothing = 'antialiased';
                    }
                }
            });
            const link = document.createElement('a');
            link.download = `ID_Card_${selectedStudent.admissionNumber}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error("ID Card Generation Failed", err);
            alert("Failed to generate ID card image");
        }
    };

    const handlePrint = () => {
        if (!cardRef.current || !selectedStudent) return;
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const cardHtml = cardRef.current.outerHTML;

        printWindow.document.write(`
        <html>
        <head>
          <title>ID Card - ${selectedStudent.name}</title>
          <style>
             body { 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                margin: 0; 
                -webkit-print-color-adjust: exact; 
             }
             .id-card-container {
                width: 320px;
                height: 510px;
                border: 1px solid #ddd;
                border-radius: 16px;
                overflow: hidden;
                position: relative;
                font-family: 'Inter', sans-serif;
                background: white;
                box-shadow: none; /* No shadow in print */
             }
          </style>
          <script src="https://cdn.tailwindcss.com"></script> 
        </head>
        <body>
          ${cardHtml}
          <script>
            setTimeout(() => {
                window.print();
                window.close();
            }, 800);
          </script>
        </body>
        </html>
     `);
        printWindow.document.close();
    };

    const barcodeValue = selectedStudent ? (() => {
        const dateStr = selectedStudent.admissionDate ? new Date(selectedStudent.admissionDate) : new Date();
        const yy = format(dateStr, 'yy');
        const serial = /^\d+$/.test(selectedStudent.admissionNumber)
            ? selectedStudent.admissionNumber.padStart(4, '0')
            : selectedStudent.admissionNumber;
        return `${yy}S${serial}`;
    })() : '';

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Generate ID Card</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>1. Select Student & Theme</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Class</Label>
                                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection(''); setSelectedStudentId(''); }}>
                                        <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                                        <SelectContent>
                                            {availableGrades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Section</Label>
                                    <Select value={selectedSection} onValueChange={(v) => { setSelectedSection(v); setSelectedStudentId(''); }}>
                                        <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                                        <SelectContent>
                                            {availableSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Student</Label>
                                <Select value={selectedStudentId} onValueChange={(v) => { setSelectedStudentId(v); setPhotoUrl(null); }}>
                                    <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                                    <SelectContent>
                                        {filteredStudents.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} ({s.admissionNumber})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 pt-2 border-t">
                                <Label>Card Theme Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {THEMES.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setThemeColor(t.value)}
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${themeColor === t.value ? 'border-black scale-110' : 'border-transparent hover:scale-105'}`}
                                            style={{ backgroundColor: t.value }}
                                            title={t.name}
                                        />
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>2. Upload Photo</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
                                {photoUrl ? (
                                    <div className="relative">
                                        <img src={photoUrl} className="w-32 h-32 object-cover rounded-md shadow-sm" alt="Preview" />
                                        <Button variant="destructive" size="sm" className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0" onClick={() => setPhotoUrl(null)}>X</Button>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-2">
                                        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                                        <div className="text-sm text-muted-foreground">Click to select photo</div>
                                    </div>
                                )}
                                <Input
                                    type="file"
                                    accept="image/*"
                                    className="mt-4"
                                    onChange={handlePhotoUpload}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Button className="w-full gap-2" size="lg" disabled={!selectedStudent} onClick={handleDownload}>
                        <Download className="w-4 h-4" /> Download PNG
                    </Button>
                    <Button variant="outline" className="w-full gap-2" size="lg" disabled={!selectedStudent} onClick={handlePrint}>
                        <Printer className="w-4 h-4" /> Print / Save as PDF
                    </Button>
                </div>

                {/* Preview */}
                <div className="flex flex-col items-center">
                    <Label className="mb-4 text-lg font-semibold">Live Preview</Label>
                    {selectedStudent ? (
                        <div
                            ref={cardRef}
                            className="id-card-container relative w-[320px] h-[510px] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col font-sans border border-gray-200"
                            style={{
                                printColorAdjust: 'exact',
                                WebkitPrintColorAdjust: 'exact'
                            }}
                        >
                            {/* Decorative Header Background via SVG */}
                            <div className="absolute top-0 left-0 w-full h-32 z-0">
                                <svg viewBox="0 0 320 128" preserveAspectRatio="none" className="w-full h-full">
                                    <path
                                        d="M0 0 H320 V80 Q160 128 0 80 Z"
                                        fill={themeColor}
                                        className="transition-colors duration-300"
                                    />
                                </svg>
                            </div>

                            {/* Header Content */}
                            <div className="relative z-10 flex flex-row items-center justify-center pt-5 px-3 text-white gap-3">
                                <div className="bg-white p-1 rounded-full shadow-md shrink-0">
                                    <SchoolLogo url={config.logoUrl} name={config.name} className="h-12 w-12 object-contain" />
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <h1 className="text-sm font-black uppercase tracking-wider leading-tight shadow-sm">
                                        {config.name}
                                    </h1>
                                    <p className="text-[9px] opacity-90 leading-tight">
                                        {config.address?.split(',')[0]}
                                    </p>
                                </div>
                            </div>

                            {/* Photo Section */}
                            <div className="relative z-20 mt-3 flex flex-col items-center">
                                <div className="w-28 h-32 bg-white p-1 rounded-xl shadow-lg transform rotate-0 hover:scale-105 transition-transform duration-300">
                                    <div
                                        className="w-full h-full rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center"
                                        style={{ borderColor: themeColor }}
                                    >
                                        {photoUrl ? (
                                            <img src={photoUrl} className="w-full h-full object-cover object-top" alt="Student" />
                                        ) : (
                                            <span className="text-gray-300 text-4xl">?</span>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="mt-[-12px] bg-[#fbbf24] text-[10px] font-bold px-3 py-0.5 rounded-full shadow-sm z-30 uppercase tracking-wide border-2 border-white"
                                    style={{ color: themeColor }}
                                >
                                    Student
                                </div>
                            </div>

                            {/* Name & ID */}
                            <div className="text-center mt-2 px-4 z-10">
                                <h2
                                    className="text-xl font-black uppercase tracking-wide leading-6"
                                    style={{ color: themeColor }}
                                >
                                    {selectedStudent.name}
                                </h2>
                                <div className="flex justify-center gap-3 mt-1 text-[11px] font-bold text-gray-600">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">ID: {selectedStudent.admissionNumber}</span>
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">Class: {selectedStudent.grade}-{selectedStudent.section}</span>
                                </div>
                            </div>

                            {/* Watermark in background */}
                            <div className="absolute inset-0 top-32 flex items-center justify-center pointer-events-none z-0">
                                <SchoolLogo url={config.logoUrl} name={config.name} className="w-56 h-56 opacity-[0.04] grayscale" />
                            </div>

                            {/* Details Grid */}
                            <div className="flex-1 mt-2 px-8 z-10 w-full">
                                <div className="space-y-1.5 text-[11px] font-medium">
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-1 items-baseline">
                                        <span className="text-gray-500 w-24 shrink-0 font-semibold">Father Name</span>
                                        <span
                                            className="font-bold text-gray-800 uppercase text-right leading-tight break-words flex-1"
                                            style={{ lineHeight: '1.2' }}
                                        >
                                            {selectedStudent.fatherName || '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-1 items-baseline">
                                        <span className="text-gray-500 w-24 shrink-0 font-semibold">Mother Name</span>
                                        <span
                                            className="font-bold text-gray-800 uppercase text-right leading-tight break-words flex-1"
                                            style={{ lineHeight: '1.2' }}
                                        >
                                            {selectedStudent.motherName || '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-1 items-baseline">
                                        <span className="text-gray-500 w-24 shrink-0 font-semibold">Date of Birth</span>
                                        <span className="font-bold text-gray-800 text-right">{selectedStudent.dateOfBirth ? format(new Date(selectedStudent.dateOfBirth), 'dd MMM yyyy') : '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-1 items-baseline">
                                        <span className="text-gray-500 w-24 shrink-0 font-semibold">Phone</span>
                                        <span className="font-bold text-gray-800 text-right">{selectedStudent.mobileNumber}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-1 items-baseline">
                                        <span className="text-gray-500 w-24 shrink-0 font-semibold">Address</span>
                                        <span
                                            className="font-bold text-gray-800 text-right leading-tight break-words flex-1 text-[10px]"
                                            style={{ lineHeight: '1.2' }}
                                        >
                                            {selectedStudent.address || '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-auto relative z-10 w-full">
                                <div className="w-full flex flex-col items-center justify-center py-1">
                                    {/* Real Barcode for Attendance */}
                                    <div className="flex flex-col items-center gap-0.5 overflow-hidden">
                                        <Barcode
                                            value={barcodeValue}
                                            format="CODE128"
                                            width={1.2}
                                            height={25}
                                            displayValue={false}
                                            background="transparent"
                                            margin={0}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-end px-6 pb-2">
                                    <div className="flex flex-col">
                                        <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Valid Till</p>
                                        <p
                                            className="text-[10px] font-bold"
                                            style={{ color: themeColor }}
                                        >
                                            Mar 2026
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-20 h-4 mb-1"></div>
                                        <div className="h-px w-24 bg-gray-300"></div>
                                        <p className="text-[8px] text-gray-500 font-bold mt-0.5 uppercase tracking-wider">Principal Signature</p>
                                    </div>
                                </div>
                                <div
                                    className="h-3 w-full transition-colors duration-300"
                                    style={{ backgroundColor: themeColor }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-[320px] h-[510px] bg-muted/20 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground">
                            Select a student to view ID Card
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
