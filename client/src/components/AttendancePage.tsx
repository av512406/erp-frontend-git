
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Save, ArrowLeft } from "lucide-react";

interface StudentAttendance {
    studentId: string;
    name: string;
    admissionNumber: string;
    rollNumber: string;
    status: 'Present' | 'Absent' | 'Leave' | 'Late' | null;
}

export default function AttendancePage() {
    const [location, setLocation] = useLocation();
    const searchParams = new URLSearchParams(window.location.search);
    const classId = searchParams.get("classId");
    const sessionId = searchParams.get("sessionId");

    // Default date to today
    const [date, setDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });

    const { toast } = useToast();
    const [students, setStudents] = useState<StudentAttendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (classId && date) {
            fetchAttendance();
        }
    }, [classId, date, sessionId]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (classId) params.append("classId", classId);
            if (date) params.append("date", date);
            if (sessionId) params.append("sessionId", sessionId);

            const res = await fetch(`/api/attendance?${params.toString()}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                // data: { studentId, name, ... status (which might be null) }
                // If status is null, default to 'Present' for new entry convenience? 
                // Or keep null to force explicit marking?
                // Let's default to Present visually if null, but keep state clean? 
                // ACTUALLY: common requirement is "Default Present".
                setStudents(data.map((s: any) => ({
                    ...s,
                    status: s.status || 'Present'
                })));
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Failed to load attendance" });
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = (studentId: string, status: StudentAttendance['status']) => {
        setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, status } : s));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const records = students.map(s => ({
                studentId: s.studentId,
                status: s.status
            }));

            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({
                    date,
                    classId,
                    records,
                    sessionId
                })
            });

            if (!res.ok) throw new Error("Failed to save");

            toast({ title: "Attendance Saved" });
        } catch (e) {
            toast({ variant: "destructive", title: "Error saving attendance" });
        } finally {
            setSaving(false);
        }
    };

    if (!classId) return <div className="p-6">Invalid Access: Missing Class ID</div>;

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="container mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                            <CardTitle>Student List</CardTitle>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="date">Date:</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">Roll No</TableHead>
                                                <TableHead>Student Name</TableHead>
                                                <TableHead>Admission No</TableHead>
                                                <TableHead className="text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {students.map((student) => (
                                                <TableRow key={student.studentId}>
                                                    <TableCell>{student.rollNumber || '-'}</TableCell>
                                                    <TableCell className="font-medium">{student.name}</TableCell>
                                                    <TableCell>{student.admissionNumber}</TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-center">
                                                            <RadioGroup
                                                                value={student.status || 'Present'}
                                                                onValueChange={(val) => handleStatusChange(student.studentId, val as any)}
                                                                className="flex gap-4"
                                                            >
                                                                {['Present', 'Absent', 'Leave'].map((statusOption) => (
                                                                    <div key={statusOption} className="flex items-center space-x-2">
                                                                        <RadioGroupItem value={statusOption} id={`${student.studentId}-${statusOption}`} />
                                                                        <Label htmlFor={`${student.studentId}-${statusOption}`} className={
                                                                            statusOption === 'Absent' ? 'text-red-500' :
                                                                                statusOption === 'Leave' ? 'text-yellow-500' : 'text-green-600'
                                                                        }>
                                                                            {statusOption.charAt(0)}
                                                                        </Label>
                                                                    </div>
                                                                ))}
                                                            </RadioGroup>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSave} disabled={saving} size="lg">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Attendance
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
