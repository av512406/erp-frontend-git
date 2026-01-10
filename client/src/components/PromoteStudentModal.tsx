import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

interface Session {
    id: string;
    name: string;
}

interface Candidate {
    id: string;
    name: string;
    admissionNumber: string;
    grade: string;
    section: string;
}

interface PromoteStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetSessionId: string;
    sessions: Session[];
    onSuccess: () => void;
}

export default function PromoteStudentModal({
    isOpen,
    onClose,
    targetSessionId,
    sessions,
    onSuccess
}: PromoteStudentModalProps) {
    const [sourceSessionId, setSourceSessionId] = useState<string>("");
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Promotion settings (bulk)
    const [targetGrade, setTargetGrade] = useState<string>("");
    // We can also support per-student mapping later, for now bulk move or keeping same grade logic?
    // Let's implement: "Keep existing grade (checking 'Repeat')" or "Increment Grade (+1)?"
    // Simpler: "Map Grade X to Grade Y". 

    // For an MVP, let's just List students and allow selecting them. 
    // We will assume for now we keep the SAME grade/section unless changed? 
    // Actually, usually you promote Class 1 -> Class 2. 
    // Let's ask user for "Target Class" for the selected batch. 

    // Strategy: 
    // 1. Select Source Session
    // 2. Fetch Candidates
    // 3. User selects students (e.g. all from Class 1)
    // 4. User selects "Promote to Class: 2"
    // 5. Submit.

    const [filterSourceGrade, setFilterSourceGrade] = useState<string>("all");

    useEffect(() => {
        if (isOpen && sourceSessionId && targetSessionId) {
            if (sourceSessionId === targetSessionId) return;
            fetchCandidates();
        }
    }, [isOpen, sourceSessionId, targetSessionId]);

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sessions/${targetSessionId}/candidates?sourceSessionId=${sourceSessionId}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setCandidates(data);
                setSelectedIds(new Set()); // reset selection
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePromote = async () => {
        if (selectedIds.size === 0) return;
        if (!targetGrade) {
            alert("Please select a target class to promote/move these students to.");
            return;
        }

        setLoading(true);
        try {
            const studentsToPromote = candidates
                .filter(c => selectedIds.has(c.id))
                .map(c => ({
                    studentId: c.id,
                    grade: targetGrade, // Promote to this grade
                    section: c.section, // Keep same section by default
                }));

            const res = await fetch('/api/students/promote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    targetSessionId,
                    students: studentsToPromote
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
                setCandidates([]);
                setSelectedIds(new Set());
            } else {
                alert("Failed to promote students");
            }
        } catch (e) {
            alert("Error promoting students");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            const ids = new Set(filteredCandidates.map(c => c.id));
            setSelectedIds(ids);
        } else {
            setSelectedIds(new Set());
        }
    };

    const uniqueSourceGrades = Array.from(new Set(candidates.map(c => c.grade))).sort((a, b) => parseInt(a) - parseInt(b));

    const filteredCandidates = candidates.filter(c => filterSourceGrade === 'all' || c.grade === filterSourceGrade);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import/Promote Students</DialogTitle>
                    <DialogDescription>
                        Move students from a previous session to the current session (Year).
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <div>
                        <Label>Source Session (From)</Label>
                        <Select value={sourceSessionId} onValueChange={setSourceSessionId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.filter(s => s.id !== targetSessionId).map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Filter Source Class</Label>
                        <Select value={filterSourceGrade} onValueChange={setFilterSourceGrade}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Classes</SelectItem>
                                {uniqueSourceGrades.map(g => (
                                    <SelectItem key={g} value={g}>Class {g}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex-1 border rounded-md overflow-hidden flex flex-col">
                    <div className="bg-muted p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={filteredCandidates.length > 0 && selectedIds.size === filteredCandidates.length}
                                onCheckedChange={toggleSelectAll}
                            />
                            <span className="text-sm font-medium">Select All ({filteredCandidates.length})</span>
                        </div>
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    <ScrollArea className="flex-1 p-2">
                        {filteredCandidates.length === 0 ? (
                            <p className="text-center text-muted-foreground p-4">No candidates found.</p>
                        ) : (
                            <div className="space-y-1">
                                {filteredCandidates.map(c => (
                                    <div key={c.id} className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm">
                                        <Checkbox
                                            checked={selectedIds.has(c.id)}
                                            onCheckedChange={(checked) => {
                                                const next = new Set(selectedIds);
                                                if (checked) next.add(c.id);
                                                else next.delete(c.id);
                                                setSelectedIds(next);
                                            }}
                                        />
                                        <div className="text-sm">
                                            <span className="font-semibold">{c.name}</span>
                                            <span className="text-muted-foreground ml-2">({c.admissionNumber})</span>
                                            <span className="ml-4 badge text-xs bg-secondary px-1 rounded">Class {c.grade} - {c.section}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="bg-primary/5 p-4 rounded-md mt-4 flex items-end gap-4 border">
                    <div className="flex-1">
                        <Label>Promote Selected To Class:</Label>
                        <Select value={targetGrade} onValueChange={setTargetGrade}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Target Class" />
                            </SelectTrigger>
                            <SelectContent>
                                {/* Generate classes 1-12 and Nursery/KG */}
                                {["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => String(i + 1))].map(c => (
                                    <SelectItem key={c} value={c}>Class {c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handlePromote} disabled={loading || selectedIds.size === 0}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Promote {selectedIds.size} Students
                    </Button>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
