import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import type { Student } from "@shared/schema";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";

type Subject = {
  id: string;
  code: string;
  name: string;
};

interface SubjectsPageProps {
  students: Student[];
}

// NOTE: This UI is frontend-only for now (no API). It demonstrates the layout and interactions.
export default function SubjectsPage({ students }: SubjectsPageProps) {
  // Subjects from API
  const [subjects, setSubjects] = useState<Subject[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/subjects');
        if (res.ok) setSubjects(await res.json());
      } catch {}
    })();
  }, []);

  // Classes list comes from API (union of students + class_subjects)
  const [allGrades, setAllGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/classes');
        if (res.ok) {
          const data: string[] = await res.json();
          setAllGrades(data);
          setSelectedGrade(prev => prev || data[0] || "");
        } else {
          // fallback from students if API not available
          const fallback = Array.from(new Set(students.map(s => s.grade))).filter(Boolean) as string[];
          fallback.sort((a,b) => (parseInt(a) || 0) - (parseInt(b) || 0));
          setAllGrades(fallback);
          setSelectedGrade(prev => prev || fallback[0] || "");
        }
      } catch {
        const fallback = Array.from(new Set(students.map(s => s.grade))).filter(Boolean) as string[];
        fallback.sort((a,b) => (parseInt(a) || 0) - (parseInt(b) || 0));
        setAllGrades(fallback);
        setSelectedGrade(prev => prev || fallback[0] || "");
      }
    })();
  }, [students]);

  // Current class→subjects, fetched per selected grade from API
  const [assigned, setAssigned] = useState<Subject[]>([]);
  useEffect(() => {
    if (!selectedGrade) return;
    (async () => {
      try {
        const res = await fetch(`/api/classes/${encodeURIComponent(selectedGrade)}/subjects`);
        if (res.ok) setAssigned(await res.json());
        else setAssigned([]);
      } catch { setAssigned([]); }
    })();
  }, [selectedGrade]);

  // Add new subject (local only)
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const handleAddSubject = () => {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!code || !name) return;
    if (subjects.some(s => s.code === code)) return;
    (async () => {
      try {
        const res = await fetch('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) });
        if (res.ok) {
          const created = await res.json();
          setSubjects(prev => [...prev, created]);
          setNewCode(""); setNewName("");
        }
      } catch {}
    })();
  };

  const handleDeleteSubject = (id: string) => {
    (async () => {
      try {
        await fetch(`/api/subjects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } finally {
        setSubjects(prev => prev.filter(s => s.id !== id));
        setAssigned(prev => prev.filter(s => s.id !== id));
      }
    })();
  };

  const [subjectToAssign, setSubjectToAssign] = useState<string>("");
  const assignedIds = new Set(assigned.map(s => s.id));
  const assignable = subjects.filter(s => !assignedIds.has(s.id));
  const [syncingAll, setSyncingAll] = useState(false);

  const handleAssign = () => {
    if (!subjectToAssign) return;
    (async () => {
      try {
        const res = await fetch(`/api/classes/${encodeURIComponent(selectedGrade)}/subjects`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjectId: subjectToAssign })
        });
        if (res.ok) {
          const sub = subjects.find(s => s.id === subjectToAssign);
          if (sub) setAssigned(prev => [...prev, sub]);
        }
      } finally {
        setSubjectToAssign("");
      }
    })();
  };

  const handleUnassign = (sid: string) => {
    (async () => {
      try {
        await fetch(`/api/classes/${encodeURIComponent(selectedGrade)}/subjects/${encodeURIComponent(sid)}`, { method: 'DELETE' });
      } finally {
        setAssigned(prev => prev.filter(s => s.id !== sid));
      }
    })();
  };
  const currentAssigned = assigned;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Subject Management</h1>
        <p className="text-muted-foreground">Define subjects and assign them to each class</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subjects catalog */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Subjects Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-code">Code</Label>
                <Input id="new-code" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. MATH" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Mathematics" />
              </div>
              <Button onClick={handleAddSubject} className="gap-2" data-testid="btn-add-subject">
                <Plus className="w-4 h-4" /> Add Subject
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No subjects</TableCell></TableRow>
                  ) : subjects.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteSubject(s.id)} aria-label={`Delete ${s.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Class assignments */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Assign Subjects to Class</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedGrade || assigned.length === 0 || syncingAll || allGrades.length === 0}
                  onClick={async () => {
                    if (!selectedGrade || assigned.length === 0) return;
                    setSyncingAll(true);
                    try {
                      const res = await fetch(`/api/classes/${encodeURIComponent(selectedGrade)}/sync-all`, { method: 'POST' });
                      if (!res.ok) {
                        // fallback client-side sync if server endpoint unavailable
                        for (const g of allGrades) {
                          for (const s of assigned) {
                            await fetch(`/api/classes/${encodeURIComponent(g)}/subjects`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ subjectId: s.id })
                            });
                          }
                        }
                      }
                      // refresh current grade's assignments
                      try {
                        const r = await fetch(`/api/classes/${encodeURIComponent(selectedGrade)}/subjects`);
                        if (r.ok) setAssigned(await r.json());
                      } catch {}
                      window.alert('Synced subjects to all classes');
                    } finally {
                      setSyncingAll(false);
                    }
                  }}
                >
                  Sync this class's subjects to all classes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {allGrades.map(g => (
                      <SelectItem key={g} value={g}>Class {g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Assign Subject</Label>
                <div className="flex items-center gap-2">
                  <Select value={subjectToAssign} onValueChange={setSubjectToAssign}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No more subjects to assign</div>
                      ) : assignable.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssign} disabled={!subjectToAssign} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Assign
                  </Button>
                </div>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentAssigned.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No subjects assigned yet</TableCell></TableRow>
                  ) : currentAssigned.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleUnassign(s.id)} aria-label={`Unassign ${s.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">Changes here are saved to the server. Clearing local storage won’t affect the class-subject assignments.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
