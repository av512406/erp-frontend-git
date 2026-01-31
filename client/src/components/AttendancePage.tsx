
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Save, ArrowLeft, Phone, UserX, MessageSquare } from "lucide-react";
import { DataTable, Column } from "@/components/ui/data-table";

interface StudentAttendance {
    studentId: string;
    name: string;
    admissionNumber: string;
    rollNumber: string;
    status: 'Present' | 'Absent' | 'Leave' | 'Late' | null;
}

interface AbsenteeRecord {
    id: string; // Added ID for DataTable generic constraint
    studentId: string;
    name: string;
    admissionNumber: string;
    fatherName: string;
    mobileNumber: string;
    className: string;
    rollNumber: string;
    status: string;
}

interface AttendancePageProps {
    selectedSessionId: string;
}

export default function AttendancePage({ selectedSessionId }: AttendancePageProps) {
    const [location, setLocation] = useLocation();
    const searchParams = new URLSearchParams(window.location.search);
    const classIdInitial = searchParams.get("classId");
    // const sessionId = searchParams.get("sessionId"); // Use prop instead

    // Default date to today
    const [date, setDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });

    const { toast } = useToast();

    // Feature Flags
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [schoolName, setSchoolName] = useState("");

    // Marking State
    const [students, setStudents] = useState<StudentAttendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Absentee View State
    const [absentees, setAbsentees] = useState<AbsenteeRecord[]>([]);
    const [loadingAbsentees, setLoadingAbsentees] = useState(false);
    const [activeTab, setActiveTab] = useState("mark");

    useEffect(() => {
        // Fetch config to check features
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/school-config', { headers: getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setSchoolName(data.name || "School");

                    // Check if 'sms' feature is enabled. 
                    // Handle both object and parsed JSON scenarios if necessary, 
                    // but typically API returns object.
                    let features = data.features;
                    if (typeof features === 'string') {
                        try { features = JSON.parse(features); } catch { features = {}; }
                    }
                    setSmsEnabled(!!features?.sms);
                }
            } catch (e) { /* ignore */ }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        if (activeTab === "mark" && classIdInitial && date) {
            fetchAttendance();
        } else if (activeTab === "report" && date) {
            fetchAbsentees();
        }
    }, [classIdInitial, date, selectedSessionId, activeTab]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (classIdInitial) params.append("classId", classIdInitial);
            if (date) params.append("date", date);
            if (selectedSessionId) params.append("sessionId", selectedSessionId);

            const res = await fetch(`/api/attendance?${params.toString()}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
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

    const fetchAbsentees = async () => {
        setLoadingAbsentees(true);
        try {
            const params = new URLSearchParams();
            params.append("date", date);
            if (selectedSessionId) params.append("sessionId", selectedSessionId);

            const res = await fetch(`/api/attendance/absent?${params.toString()}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                // Add ID for DataTable
                setAbsentees(data.map((r: any, idx: number) => ({ ...r, id: r.admissionNumber || String(idx), studentId: r.admissionNumber || String(idx) })));
            }
        } catch (e: any) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Failed to load absentee report",
                description: e.message || "Unknown error"
            });
        } finally {
            setLoadingAbsentees(false);
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
                    classId: classIdInitial,
                    records,
                    sessionId: selectedSessionId
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

    // If no classId is provided, we default to showing the report view.
    useEffect(() => {
        if (!classIdInitial) {
            setActiveTab("report");
        }
    }, [classIdInitial]);

    // Define Columns for Absentee Report
    const absenteeColumns: Column<AbsenteeRecord>[] = [
        { header: "Class", accessorKey: "className", sortable: true },
        {
            header: "Student",
            accessorKey: "name",
            sortable: true,
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.rollNumber ? `Role: ${row.rollNumber}` : ''} {row.admissionNumber}</div>
                </div>
            )
        },
        { header: "Father Name", accessorKey: "fatherName" },
        {
            header: "Mobile",
            accessorKey: "mobileNumber",
            cell: (row) => (
                row.mobileNumber ? (
                    <a href={`tel:${row.mobileNumber}`} className="flex items-center text-blue-600 hover:underline">
                        <Phone className="h-3 w-3 mr-1" /> {row.mobileNumber}
                    </a>
                ) : <span className="text-muted-foreground">-</span>
            )
        },
        {
            header: "Status",
            accessorKey: "status",
            sortable: true,
            cell: (row) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {row.status}
                </span>
            )
        },
        // Action Column for SMS
        {
            header: "Action",
            cell: (row) => smsEnabled && row.mobileNumber ? (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2"
                    onClick={() => {
                        const message = `Dear Parent,\n\n${row.name} is absent today (${date}). Kindly ensure regular attendance.\n\nRegards,\nPrincipal\n${schoolName}`;
                        window.open(`sms:${row.mobileNumber}?body=${encodeURIComponent(message)}`, '_blank');
                    }}
                >
                    <MessageSquare className="h-4 w-4" /> SMS
                </Button>
            ) : null
        }
    ];

    return (
        <div className="min-h-screen bg-background p-4 md:p-6">
            <div className="container mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Attendance Management</h1>
                </div>

                <div className="flex items-center gap-2 mb-4">
                    <Label htmlFor="date" className="font-semibold">Selected Date:</Label>
                    <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-40"
                    />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="mark" disabled={!classIdInitial}>Mark Attendance</TabsTrigger>
                        <TabsTrigger value="report">Absentee Report</TabsTrigger>
                    </TabsList>

                    <TabsContent value="mark">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                                    <CardTitle>Mark Class Attendance</CardTitle>
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
                                                        <TableHead className="w-[80px]">Roll No</TableHead>
                                                        <TableHead>Student Name</TableHead>
                                                        <TableHead className="hidden md:table-cell">Admission No</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {students.map((student) => (
                                                        <TableRow key={student.studentId}>
                                                            <TableCell>{student.rollNumber || '-'}</TableCell>
                                                            <TableCell className="font-medium">
                                                                {student.name}
                                                                <div className="md:hidden text-xs text-muted-foreground">{student.admissionNumber}</div>
                                                            </TableCell>
                                                            <TableCell className="hidden md:table-cell">{student.admissionNumber}</TableCell>
                                                            <TableCell>
                                                                <div className="flex justify-center">
                                                                    <RadioGroup
                                                                        value={student.status || 'Present'}
                                                                        onValueChange={(val) => handleStatusChange(student.studentId, val as any)}
                                                                        className="flex gap-2 md:gap-4"
                                                                    >
                                                                        {['Present', 'Absent', 'Leave'].map((statusOption) => (
                                                                            <div key={statusOption} className="flex items-center space-x-1 md:space-x-2">
                                                                                <RadioGroupItem value={statusOption} id={`${student.studentId}-${statusOption}`} />
                                                                                <Label htmlFor={`${student.studentId}-${statusOption}`} className={
                                                                                    statusOption === 'Absent' ? 'text-red-500 text-xs md:text-sm' :
                                                                                        statusOption === 'Leave' ? 'text-yellow-500 text-xs md:text-sm' : 'text-green-600 text-xs md:text-sm'
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
                                            <Button onClick={handleSave} disabled={saving} size="lg" className="w-full md:w-auto">
                                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Save Attendance
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="report">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserX className="h-5 w-5 text-red-500" />
                                    Absentee List
                                </CardTitle>
                                <CardDescription>Consolidated list of absent students for {date}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingAbsentees ? (
                                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : (
                                    <DataTable
                                        columns={absenteeColumns}
                                        data={absentees}
                                        searchKey="name"
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
