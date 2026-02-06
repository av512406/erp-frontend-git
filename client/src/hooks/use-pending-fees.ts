import { useMemo, useState, useEffect } from "react";
import type { Student, FeeTransaction } from "@/types";
import { sortGrades } from "@/lib/utils";

export interface StudentWithPending extends Student {
    yearly: number;
    previousDue: number;
    transportFee: number;
    paid: number;
    pending: number;
}

export function usePendingFees(students: Student[], transactions: FeeTransaction[]) {
    const [pendingFilterClass, setPendingFilterClass] = useState<string>("all");
    const [pendingFilterSection, setPendingFilterSection] = useState<string>("all");

    const studentsWithPendingFees = useMemo(() => {
        return students.map(s => {
            const yearly = parseFloat((s as any).yearlyFeeAmount || '0');
            const previousDue = parseFloat((s as any).previousYearDue || '0');
            const transportFee = parseFloat((s as any).transportFee || '0');
            const paid = transactions
                .filter(t => t.studentId === s.id && t.status !== 'cancelled')
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            const pending = (yearly + previousDue + transportFee) - paid;
            return { ...s, yearly, previousDue, transportFee, paid, pending } as StudentWithPending;
        }).filter(s => s.pending > 0);
    }, [students, transactions]);

    const uniquePendingClasses = useMemo(() => {
        return sortGrades(Array.from(new Set(studentsWithPendingFees.map(s => s.grade?.trim()))).filter(Boolean) as string[]);
    }, [studentsWithPendingFees]);

    const uniquePendingSections = useMemo(() => {
        const pool = pendingFilterClass === 'all' ? studentsWithPendingFees : studentsWithPendingFees.filter(s => s.grade?.trim() === pendingFilterClass);
        return Array.from(new Set(pool.map(s => s.section?.trim()))).filter(Boolean).sort() as string[];
    }, [studentsWithPendingFees, pendingFilterClass]);

    const filteredPendingStudents = useMemo(() => {
        return studentsWithPendingFees.filter(s => {
            const classMatch = pendingFilterClass === 'all' || s.grade?.trim() === pendingFilterClass;
            const sectionMatch = pendingFilterSection === 'all' || s.section?.trim() === pendingFilterSection;
            return classMatch && sectionMatch;
        });
    }, [studentsWithPendingFees, pendingFilterClass, pendingFilterSection]);

    // Reset section when class changes if the section doesn't exist in the new class
    useEffect(() => {
        if (pendingFilterSection !== 'all' && !uniquePendingSections.includes(pendingFilterSection)) {
            setPendingFilterSection('all');
        }
    }, [pendingFilterClass, uniquePendingSections, uniquePendingClasses]); // Added uniquePendingClasses to dep array just to be safe, though uniquePendingSections change should trigger it.

    return {
        studentsWithPendingFees,
        filteredPendingStudents,
        uniquePendingClasses,
        uniquePendingSections,
        pendingFilterClass,
        setPendingFilterClass,
        pendingFilterSection,
        setPendingFilterSection
    };
}
