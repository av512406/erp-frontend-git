import React, { useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { Student } from '@shared/schema';
import { schoolConfig } from '@/lib/schoolConfig';
import { useDocumentTemplate } from '@/hooks/useDocumentTemplate';

interface TransferCertificateModalProps {
    open: boolean;
    onClose: () => void;
    student: Student | null;
}

export default function TransferCertificateModal({ open, onClose, student }: TransferCertificateModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { data: template } = useDocumentTemplate('transfer_certificate');

    if (!student) return null;

    // Dynamic configuration for TC fields
    const tcFields = [
        { label: "TC Number", value: `TC/${new Date().getFullYear()}/${student.admissionNumber}` },
        { label: "Admission Number", value: student.admissionNumber },
        { label: "Name of Student", value: student.name },
        { label: "Father's/Guardian's Name", value: student.fatherName || '__________________' },
        { label: "Mother's Name", value: student.motherName || '__________________' },
        { label: "Date of Birth", value: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '__________________' },
        { label: "Class Last Studied", value: `Class ${student.grade}` },
        { label: "Date of Leaving", value: student.leftDate ? new Date(student.leftDate).toLocaleDateString() : '__________________' },
        { label: "Reason for Leaving", value: student.leavingReason || '__________________' },
        { label: "General Conduct", value: "Good" }, // Default value, could be dynamic later
    ];

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            // If template exists, use it. Otherwise use default.
            const content = template ? template.content : `
        <html>
          <head>
            <title>Transfer Certificate - ${student.name}</title>
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
                  height: 95vh; 
                  display: flex; 
                  flex-direction: column; 
                  justify-content: space-between; 
              }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
              .header-content { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 5px; }
              .logo { height: 60px; object-fit: contain; }
              .school-info { text-align: center; }
              .school-name { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
              .school-address { font-size: 12px; font-style: italic; margin-top: 2px; }
              .contact-info { font-size: 11px; margin-top: 2px; }
              .tc-title { 
                  font-size: 18px; 
                  font-weight: bold; 
                  text-decoration: underline; 
                  text-align: center; 
                  margin: 15px 0; 
                  text-transform: uppercase;
              }
              .content { font-size: 13px; line-height: 1.5; flex-grow: 1; padding: 0 10px; }
              .row { display: flex; margin-bottom: 8px; align-items: baseline; }
              .label { font-weight: bold; width: 200px; flex-shrink: 0; }
              .value { border-bottom: 1px dotted #000; flex: 1; padding-left: 10px; font-weight: 500; }
              .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 20px 20px; }
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
            ${printContent.innerHTML}
          </body>
        </html>
      `;

            // If using template, we need to replace placeholders.
            // For now, the default logic reuses the innerHTML of the rendered component.
            // If we switch to full server-side templates later, we'd do string replacement here.
            // But since the requirement is "different report card... for schools", 
            // and we are storing HTML in the DB, we should probably render THAT HTML if it exists.

            // However, the current component renders the "Default" view into the DOM, and then prints it.
            // To support a custom template, we should probably render the custom template into the DOM *instead* of the default one.

            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };

    // Helper to render the default view or the custom template
    const renderContent = () => {
        if (template) {
            // Simple placeholder replacement for now. 
            // In a real app, we might use a proper template engine or just more robust replacement.
            let html = template.content;
            // Replace basic fields
            html = html.replace(/{{studentName}}/g, student.name);
            html = html.replace(/{{admissionNumber}}/g, student.admissionNumber);
            // ... add more replacements as needed
            return <div dangerouslySetInnerHTML={{ __html: html }} />;
        }

        return (
            <div className="container" style={{ border: '2px solid #000', padding: '20px', minHeight: '800px', display: 'flex', flexDirection: 'column' }}>
                <div className="header" style={{ borderBottom: '1px solid #000', paddingBottom: '10px', marginBottom: '20px', textAlign: 'center' }}>
                    <div className="header-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                        {schoolConfig.logoUrl && (
                            <img src={schoolConfig.logoUrl} alt="Logo" style={{ height: '60px', objectFit: 'contain' }} />
                        )}
                        <div className="school-info">
                            <div className="school-name" style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>{schoolConfig.name}</div>
                            <div className="school-address" style={{ fontSize: '12px', fontStyle: 'italic' }}>{schoolConfig.addressLine}</div>
                            <div className="contact-info" style={{ fontSize: '11px' }}>Phone: {schoolConfig.phone} | Email: {schoolConfig.email}</div>
                        </div>
                    </div>
                </div>

                <div className="tc-title" style={{ fontSize: '18px', fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center', margin: '15px 0', textTransform: 'uppercase' }}>
                    TRANSFER CERTIFICATE
                </div>

                <div className="content" style={{ fontSize: '13px', lineHeight: '1.5', flexGrow: 1, padding: '0 10px' }}>
                    {tcFields.map((field, index) => (
                        <div key={index} className="row" style={{ display: 'flex', marginBottom: '8px', alignItems: 'baseline' }}>
                            <div className="label" style={{ fontWeight: 'bold', width: '200px', flexShrink: 0 }}>{field.label}:</div>
                            <div className="value" style={{ borderBottom: '1px dotted #000', flex: 1, paddingLeft: '10px', fontWeight: 500 }}>{field.value}</div>
                        </div>
                    ))}
                </div>

                <div className="footer" style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 20px 20px' }}>
                    <div className="signature" style={{ textAlign: 'center', width: '150px' }}>
                        <div className="sign-line" style={{ borderTop: '1px solid #000', marginTop: '40px', paddingTop: '5px', fontSize: '12px', fontWeight: 'bold' }}>Prepared By</div>
                    </div>
                    <div className="signature" style={{ textAlign: 'center', width: '150px' }}>
                        <div className="sign-line" style={{ borderTop: '1px solid #000', marginTop: '40px', paddingTop: '5px', fontSize: '12px', fontWeight: 'bold' }}>Class Teacher</div>
                    </div>
                    <div className="signature" style={{ textAlign: 'center', width: '150px' }}>
                        <div className="sign-line" style={{ borderTop: '1px solid #000', marginTop: '40px', paddingTop: '5px', fontSize: '12px', fontWeight: 'bold' }}>Principal</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Transfer Certificate Preview</DialogTitle>
                </DialogHeader>

                <div className="flex justify-end mb-4">
                    <Button onClick={handlePrint} className="gap-2">
                        <Printer className="w-4 h-4" /> Print TC
                    </Button>
                </div>

                <div className="border p-4 bg-white text-black font-serif" ref={printRef}>
                    {renderContent()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
