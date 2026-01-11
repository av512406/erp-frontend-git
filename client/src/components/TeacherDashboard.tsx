
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Users, CalendarCheck, ClipboardList, TrendingUp, IndianRupee, RefreshCcw, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast"; // Ensure hook exists or use standard Toast
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TeacherClassInfo {
    teacher: { id: string; name: string };
    class: { id: string; grade: string; section: string } | null;
}

interface Student {
    id: string;
    name: string;
    admissionNumber: string;
    rollNumber: string;
    yearlyFee: number;
    totalPaid: number;
    balance: number;
    mobileNumber: string;
}

interface AttendanceSummary {
    studentId: string;
    name: string;
    rollNumber: string;
    present: number;
    absent: number;
    leave: number;
    late: number;
    total: number;
    percentage: string;
}

export default function TeacherDashboard({ selectedSessionId }: { selectedSessionId?: string }) {
    const [info, setInfo] = useState<TeacherClassInfo | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendanceStats, setAttendanceStats] = useState<AttendanceSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const { toast } = useToast();

    // Fetch Report with Date Filter
    const fetchReport = async () => {
        if (!info?.class) return;
        try {
            const params = new URLSearchParams();
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            if (selectedSessionId) params.append("sessionId", selectedSessionId);

            const attRes = await fetch(`/api/teacher/my-class/attendance-summary?${params.toString()}`, { headers: getAuthHeaders() });
            if (attRes.ok) setAttendanceStats(await attRes.json());
        } catch (e) {
            console.error(e);
        }
    };

    // Auto-fetch removed; replaced by manual Filter button action

    const handleAssignRollNumbers = async () => {
        if (!info?.class?.id) return;
        try {
            const res = await fetch('/api/classes/assign-roll-numbers', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: info.class.id, sessionId: selectedSessionId })
            });
            if (res.ok) {
                toast({ title: "Success", description: "Roll numbers assigned alphabetically." });
                // Reload students
                const stuRes = await fetch("/api/teacher/my-class/students", { headers: getAuthHeaders() });
                if (stuRes.ok) setStudents(await stuRes.json());
            } else {
                throw new Error("Failed");
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to assign roll numbers", variant: "destructive" });
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                // 1. Fetch Class Info
                const res = await fetch("/api/teacher/my-class", { headers: getAuthHeaders() });
                if (!res.ok) throw new Error("Failed to load class info");
                const data = await res.json();
                setInfo(data);

                if (data.class) {
                    // 2. Fetch Students
                    const stuParams = new URLSearchParams();
                    if (selectedSessionId) stuParams.append("sessionId", selectedSessionId);

                    const stuRes = await fetch(`/api/teacher/my-class/students?${stuParams.toString()}`, { headers: getAuthHeaders() });
                    if (stuRes.ok) setStudents(await stuRes.json());

                    // 3. Fetch Attendance Stats
                    const attParams = new URLSearchParams();
                    if (selectedSessionId) attParams.append("sessionId", selectedSessionId);

                    const attRes = await fetch(`/api/teacher/my-class/attendance-summary?${attParams.toString()}`, { headers: getAuthHeaders() });
                    if (attRes.ok) setAttendanceStats(await attRes.json());
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedSessionId]);

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    if (!info) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                Could not load teacher profile. Please contact admin.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="container mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Welcome, {info.teacher.name}</h1>
                        <p className="text-muted-foreground">Teacher Dashboard</p>
                    </div>
                    {info.class && (
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-lg px-4 py-1">
                                Class {info.class.grade}-{info.class.section}
                            </Badge>
                        </div>
                    )}
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="students" disabled={!info.class}>My Students</TabsTrigger>
                        <TabsTrigger value="attendance" disabled={!info.class}>Attendance Report</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" /> My Class
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {info.class ? (
                                        <div className="space-y-4">
                                            <div className="text-2xl font-bold">
                                                {students.length} Students
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Active students in {info.class.grade}-{info.class.section}
                                            </p>
                                            <Link href={`/attendance?classId=${info.class.id}${selectedSessionId ? `&sessionId=${selectedSessionId}` : ''}`}>
                                                <Button className="w-full mt-2">
                                                    <CalendarCheck className="mr-2 h-4 w-4" />
                                                    Mark Today's Attendance
                                                </Button>
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground">
                                            You are not assigned to any class yet.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ClipboardList className="h-5 w-5" /> Quick Actions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start" asChild>
                                        <Link href="/grades">
                                            <>Enter Grades</>
                                        </Link>
                                    </Button>
                                    {/* Additional actions can go here */}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="students">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Student List</CardTitle>
                                    <CardDescription>Details of students in Class {info.class?.grade}-{info.class?.section}</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={handleAssignRollNumbers}>
                                    <RefreshCcw className="h-4 w-4 mr-2" />
                                    Auto-Assign Roll No
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Roll No</TableHead>
                                            <TableHead>Admission No</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Mobile</TableHead>
                                            {/* Financials Hidden for Teacher */}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center">No students found</TableCell>
                                            </TableRow>
                                        ) : (
                                            students.map((sys) => (
                                                <TableRow key={sys.id}>
                                                    <TableCell>{sys.rollNumber || '-'}</TableCell>
                                                    <TableCell>{sys.admissionNumber}</TableCell>
                                                    <TableCell className="font-medium">{sys.name}</TableCell>
                                                    <TableCell>{sys.mobileNumber}</TableCell>
                                                    {/* Financials Hidden */}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="attendance">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Attendance Report</CardTitle>
                                    <CardDescription>Summary of attendance for current session</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">From:</span>
                                        <Input
                                            type="date"
                                            className="w-40"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">To:</span>
                                        <Input
                                            type="date"
                                            className="w-40"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                    <Button variant="outline" size="sm" onClick={fetchReport}>
                                        <Filter className="h-4 w-4 mr-2" /> Filter
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Roll No</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="text-center">Total Days</TableHead>
                                            <TableHead className="text-center text-green-600">Present</TableHead>
                                            <TableHead className="text-center text-red-600">Absent</TableHead>
                                            <TableHead className="text-center text-yellow-600">Leave</TableHead>
                                            <TableHead className="text-right">Percentage</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendanceStats.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center">No attendance records found</TableCell>
                                            </TableRow>
                                        ) : (
                                            attendanceStats.map((stat) => (
                                                <TableRow key={stat.studentId}>
                                                    <TableCell>{stat.rollNumber || '-'}</TableCell>
                                                    <TableCell className="font-medium">{stat.name}</TableCell>
                                                    <TableCell className="text-center">{stat.total}</TableCell>
                                                    <TableCell className="text-center text-green-600">{stat.present}</TableCell>
                                                    <TableCell className="text-center text-red-600">{stat.absent}</TableCell>
                                                    <TableCell className="text-center text-yellow-600">{stat.leave}</TableCell>
                                                    <TableCell className="text-right font-bold">{stat.percentage}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
