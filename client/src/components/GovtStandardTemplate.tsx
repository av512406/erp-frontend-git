import React from 'react';
import { SchoolDetails, StudentTCDetails } from '../types';

interface Props {
    school: SchoolDetails;
    student: StudentTCDetails;
}

export const GovtStandardTemplate: React.FC<Props> = ({ school, student }) => {
    return (
        <div id="tc-print-area" className="w-full h-full bg-white p-8 border-4 border-double border-gray-800 font-serif text-black relative mx-auto" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
            {/* Header */}
            <div className="mb-6 border-b-2 border-gray-800 pb-4">
                <div className="flex items-center justify-center gap-6">
                    {school.logoUrl && (
                        <img src={school.logoUrl} alt="Logo" className="h-24 w-auto object-contain" />
                    )}
                    <div className="text-left">
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-1">{school.name}</h1>
                        <p className="text-sm font-bold mb-1">{school.address}</p>
                        <div className="flex gap-3 text-xs font-bold mt-1">
                            <span>Affiliation No: {school.affiliationNo}</span>
                            <span>|</span>
                            <span>School Code: {school.schoolCode}</span>
                        </div>
                    </div>
                </div>
            </div>

            <h2 className="text-center text-xl font-bold underline mb-6 uppercase">Transfer Certificate</h2>

            {/* Meta Data */}
            <div className="flex justify-between mb-4 text-sm font-bold">
                <span>TC Number: {student.tcNumber}</span>
                <span>Admission No: {student.admissionNumber}</span>
            </div>

            {/* Tabular Content */}
            <table className="w-full text-sm border-collapse border border-gray-400 font-bold">
                <tbody>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 w-12 text-center">1</td>
                        <td className="p-2 border-r border-gray-300 w-1/3">APAAR ID ("One Nation, One Student" ID)</td>
                        <td className="p-2">{student.apaarId}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 w-12 text-center">2</td>
                        <td className="p-2 border-r border-gray-300 w-1/3">PEN (Permanent Education No.)</td>
                        <td className="p-2">{student.penNumber}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">3</td>
                        <td className="p-2 border-r border-gray-300">Name of Pupil</td>
                        <td className="p-2 uppercase">{student.studentName}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">4</td>
                        <td className="p-2 border-r border-gray-300">Mother's Name</td>
                        <td className="p-2">{student.motherName}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">5</td>
                        <td className="p-2 border-r border-gray-300">Father's / Guardian's Name</td>
                        <td className="p-2">{student.fatherName}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">6</td>
                        <td className="p-2 border-r border-gray-300">Date of Birth (in Christian Era)</td>
                        <td className="p-2">{student.dob}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">7</td>
                        <td className="p-2 border-r border-gray-300">Nationality</td>
                        <td className="p-2">{student.nationality}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">8</td>
                        <td className="p-2 border-r border-gray-300">Whether the candidate belongs to SC/ST/OBC</td>
                        <td className="p-2">{student.casteCategory}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">9</td>
                        <td className="p-2 border-r border-gray-300">Date of first admission in the School with Class</td>
                        <td className="p-2">{student.dateOfAdmission}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">10</td>
                        <td className="p-2 border-r border-gray-300">Class in which the pupil last studied</td>
                        <td className="p-2">{student.currentClass}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">11</td>
                        <td className="p-2 border-r border-gray-300">School/Board Annual Examination last taken with result</td>
                        <td className="p-2">{student.lastExamResult}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">12</td>
                        <td className="p-2 border-r border-gray-300">Whether qualified for promotion to higher class</td>
                        <td className="p-2">{student.qualifiedForPromotion}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">13</td>
                        <td className="p-2 border-r border-gray-300">Subjects Studied</td>
                        <td className="p-2">{student.subjectsStudied}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">14</td>
                        <td className="p-2 border-r border-gray-300">General Conduct</td>
                        <td className="p-2">{student.generalConduct}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 text-center">15</td>
                        <td className="p-2 border-r border-gray-300">Date of Issue of Certificate</td>
                        <td className="p-2">{student.dateOfIssue}</td>
                    </tr>
                    <tr>
                        <td className="p-2 border-r border-gray-300 text-center">16</td>
                        <td className="p-2 border-r border-gray-300">Reason for leaving the school</td>
                        <td className="p-2">{student.reasonForLeaving}</td>
                    </tr>
                </tbody>
            </table>

            {/* Footer Signatures */}
            <div className="flex justify-between items-end mt-16 px-4 font-bold">
                <div className="text-center">
                    <div className="w-32 border-b-2 border-black mb-1"></div>
                    <p className="text-xs">Prepared By</p>
                </div>
                <div className="text-center">
                    <div className="w-32 border-b-2 border-black mb-1"></div>
                    <p className="text-xs">Checked By</p>
                </div>
                <div className="text-center">
                    <div className="w-32 border-b-2 border-black mb-1"></div>
                    <p className="text-xs">Principal Signature & Seal</p>
                </div>
            </div>
        </div>
    );
};
