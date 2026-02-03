
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { sortGrades, formatClass } from "@/lib/utils";

interface ClassItem {
    id: string;
    grade: string;
    section: string;
    class_teacher_id: string | null;
    teacher_name?: string;
}

interface Teacher {
    id: string;
    name: string;
}

export default function AdminClassesPage() {
    const { toast } = useToast();
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

    // Form states
    const [newGrade, setNewGrade] = useState("");
    const [newSection, setNewSection] = useState("");
    const [selectedTeacherId, setSelectedTeacherId] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [clsRes, teaRes] = await Promise.all([
                fetch("/api/classes", { headers: getAuthHeaders() }),
                fetch("/api/users/teachers", { headers: getAuthHeaders() })
            ]);

            if (clsRes.ok) {
                const data: ClassItem[] = await clsRes.json();
                console.log('Classes Data:', data);
                // Sort classes by grade using sortGrades helper for consistent order
                data.sort((a, b) => {
                    const sorted = sortGrades([a.grade, b.grade]);
                    if (sorted[0] === a.grade && sorted[1] !== a.grade) return -1;
                    if (sorted[0] === b.grade && sorted[1] !== b.grade) return 1;
                    return a.section.localeCompare(b.section);
                });
                setClasses(data);
            }
            if (teaRes.ok) setTeachers(await teaRes.json());
        } catch (e) {
            toast({
                variant: "destructive",
                title: "Error fetching data",
                description: "Could not load classes or teachers"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/classes", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ grade: newGrade.trim(), section: newSection.trim() })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to create class");
            }

            toast({ title: "Class Created" });
            setIsAddOpen(false);
            setNewGrade("");
            setNewSection("");
            fetchData();
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: e.message
            });
        }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm("Are you sure? This cannot be undone.")) return;
        try {
            const res = await fetch(`/api/classes/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            if (res.ok) {
                toast({ title: "Class Deleted" });
                fetchData();
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Error deleting class" });
        }
    };

    const handleAssignTeacher = async () => {
        if (!selectedClass || !selectedTeacherId) return;
        try {
            const res = await fetch(`/api/classes/${selectedClass.id}/assign-teacher`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ teacherId: selectedTeacherId })
            });

            if (res.ok) {
                toast({ title: "Teacher Assigned" });
                setIsAssignOpen(false);
                setSelectedTeacherId("");
                fetchData();
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Error assigning teacher" });
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="container mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Class
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Class</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddClass} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Grade / Standard</Label>
                                    <Input
                                        placeholder="e.g. 10"
                                        value={newGrade}
                                        onChange={e => setNewGrade(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Section</Label>
                                    <Input
                                        placeholder="e.g. A"
                                        value={newSection}
                                        onChange={e => setNewSection(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full">Create Class</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All Classes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Grade</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead>Class Teacher</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                            No classes found. Add one to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    classes.map(cls => (
                                        <TableRow key={cls.id}>
                                            <TableCell className="font-medium">{cls.grade || <span className="text-red-500">?</span>}</TableCell>
                                            <TableCell>{cls.section || <span className="text-red-500">?</span>}</TableCell>
                                            <TableCell>
                                                {cls.teacher_name || <span className="text-muted-foreground italic">None assigned</span>}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedClass(cls);
                                                        setSelectedTeacherId(cls.class_teacher_id || "");
                                                        setIsAssignOpen(true);
                                                    }}
                                                >
                                                    <UserPlus className="h-4 w-4 mr-1" /> Assign Teacher
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteClass(cls.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Assign Teacher Dialog */}
                <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Assign Class Teacher</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Select Teacher for {selectedClass ? formatClass(selectedClass.grade, selectedClass.section) : 'Class'}</Label>
                                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a teacher" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {teachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
                                <Button onClick={handleAssignTeacher}>Save Assignment</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </div>
    );
}
