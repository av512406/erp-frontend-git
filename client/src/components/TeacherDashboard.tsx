
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Users, CalendarCheck, ClipboardList } from "lucide-react";

interface TeacherClassInfo {
    teacher: { id: string; name: string };
    class: { id: string; grade: string; section: string } | null;
}

export default function TeacherDashboard() {
    const [info, setInfo] = useState<TeacherClassInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/teacher/my-class", { headers: getAuthHeaders() })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("Failed to load");
            })
            .then(data => setInfo(data))
            .catch(() => setInfo(null))
            .finally(() => setLoading(false));
    }, []);

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
                </div>

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
                                        Class {info.class.grade}-{info.class.section}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        You are the assigned class teacher.
                                    </p>
                                    <Link href={`/attendance?classId=${info.class.id}`}>
                                        <Button className="w-full mt-2">
                                            <CalendarCheck className="mr-2 h-4 w-4" />
                                            Mark Attendance
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
                            {/* Add more teacher links here */}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
