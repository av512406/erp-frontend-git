import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer } from "lucide-react";
import type { Student } from '@shared/schema';
import { schoolConfig } from '@/lib/schoolConfig';
import { formatClass } from '@/lib/utils';
import { GovtStandardTemplate } from './GovtStandardTemplate';
import { SchoolDetails, StudentTCDetails } from '../types';

interface TransferCertificateModalProps {
    open: boolean;
    onClose: () => void;
    student: Student | null;
}

export function TransferCertificateModal({ open, onClose, student }: TransferCertificateModalProps) {
    const [tcData, setTcData] = useState<StudentTCDetails | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (student) {
            // Map student data to TC details
            const initialData: StudentTCDetails = {
                tcNumber: `TC/${new Date().getFullYear()}/${student.admissionNumber}`,
                admissionNumber: student.admissionNumber,
                studentName: student.name,
                motherName: student.motherName || '',
                fatherName: student.fatherName || '',
                dob: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : '',
                nationality: student.nationality || 'Indian',
                casteCategory: student.category || 'General',
                dateOfAdmission: student.admissionDate ? new Date(student.admissionDate).toLocaleDateString('en-GB') : '',
                classAdmitted: '', // info not always available in basic student record
                currentClass: formatClass(student.grade || '', student.section),
                lastExamResult: 'Passed',
                qualifiedForPromotion: 'Yes',
                subjectsStudied: 'English, Hindi, Mathematics, Science, Social Science',
                // Handle schema typo if present: aaparId vs apaarId
                apaarId: (student as any).aaparId || (student as any).apaarId || '',
                penNumber: (student as any).penNumber || '',
                generalConduct: 'Good',
                dateOfIssue: new Date().toLocaleDateString('en-GB'),
                reasonForLeaving: student.leavingReason || 'Parent\'s Request'
            };
            setTcData(initialData);
        }
    }, [student]);

    const handlePrint = () => {
        if (!printRef.current) return;

        const printContent = printRef.current.innerHTML;
        const width = 1000;
        const height = 900;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const printWindow = window.open('', '', `width=${width},height=${height},top=${top},left=${left}`);
        if (!printWindow) return;

        // Collect logic to get styles
        const styles = Array.from(document.styleSheets)
            .map(sheet => {
                try {
                    return Array.from(sheet.cssRules).map(rule => rule.cssText).join('');
                } catch (e) {
                    return '';
                }
            })
            .join('\n');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Transfer Certificate - ${tcData?.studentName}</title>
                    <style>
                        ${styles}
                        body { background: white; padding: 20px; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; padding: 0; }
                            @page { size: A4; margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = () => {
                            window.print();
                            // window.close(); // Optional: close after print
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!student || !tcData) return null;

    const schoolDetails: SchoolDetails = {
        name: schoolConfig.name,
        address: schoolConfig.address,
        affiliationNo: schoolConfig.affiliationNo || 'PENDING',
        schoolCode: schoolConfig.schoolCode || 'PENDING',
        logoUrl: schoolConfig.logoUrl,
        email: schoolConfig.email
    };

    const updateField = (field: keyof StudentTCDetails, value: string) => {
        setTcData(prev => prev ? { ...prev, [field]: value } : null);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Generate Transfer Certificate</DialogTitle>
                    <DialogDescription>Review and edit details before printing the TC.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel: Form */}
                    <ScrollArea className="w-1/3 border-r bg-muted/10">
                        <div className="p-6 space-y-4">
                            <h3 className="font-semibold mb-4">Edit Details</h3>

                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>TC Number</Label>
                                    <Input value={tcData.tcNumber} onChange={e => updateField('tcNumber', e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Admission No</Label>
                                    <Input value={tcData.admissionNumber} onChange={e => updateField('admissionNumber', e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Student Name</Label>
                                    <Input value={tcData.studentName} onChange={e => updateField('studentName', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Mother's Name</Label>
                                        <Input value={tcData.motherName} onChange={e => updateField('motherName', e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Father's Name</Label>
                                        <Input value={tcData.fatherName} onChange={e => updateField('fatherName', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>DOB (DD/MM/YYYY)</Label>
                                    <div className="flex gap-2">
                                        <Input value={tcData.dob} onChange={e => updateField('dob', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Nationality</Label>
                                        <Input value={tcData.nationality} onChange={e => updateField('nationality', e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Category</Label>
                                        <Input value={tcData.casteCategory} onChange={e => updateField('casteCategory', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Date of Admission</Label>
                                    <div className="flex gap-2">
                                        <Input value={tcData.dateOfAdmission} onChange={e => updateField('dateOfAdmission', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Current Class</Label>
                                    <Input value={tcData.currentClass} onChange={e => updateField('currentClass', e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Last Exam Result</Label>
                                    <Input value={tcData.lastExamResult} onChange={e => updateField('lastExamResult', e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Qualified for Promotion</Label>
                                    <Input value={tcData.qualifiedForPromotion} onChange={e => updateField('qualifiedForPromotion', e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Subjects Studied</Label>
                                    <Input value={tcData.subjectsStudied} onChange={e => updateField('subjectsStudied', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>APAAR ID</Label>
                                        <Input value={tcData.apaarId} onChange={e => updateField('apaarId', e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>PEN</Label>
                                        <Input value={tcData.penNumber} onChange={e => updateField('penNumber', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>General Conduct</Label>
                                    <Input value={tcData.generalConduct} onChange={e => updateField('generalConduct', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Date of Issue</Label>
                                        <Input value={tcData.dateOfIssue} onChange={e => updateField('dateOfIssue', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Reason for Leaving</Label>
                                    <Input value={tcData.reasonForLeaving} onChange={e => updateField('reasonForLeaving', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Right Panel: Preview */}
                    <div className="flex-1 flex flex-col bg-slate-100">
                        <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm z-10">
                            <h3 className="font-semibold text-slate-700">Live Preview</h3>
                            <Button onClick={handlePrint} className="gap-2">
                                <Printer className="w-4 h-4" />
                                Print Certificate
                            </Button>
                        </div>
                        <ScrollArea className="flex-1 p-8">
                            <div className="max-w-[210mm] mx-auto shadow-lg bg-white origin-top scale-100">
                                <div ref={printRef}>
                                    <GovtStandardTemplate
                                        school={schoolDetails}
                                        student={tcData}
                                    />
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
