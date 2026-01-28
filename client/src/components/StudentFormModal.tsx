import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import type { Student, InsertStudent } from "@shared/schema";
import { insertStudentSchema } from "@shared/schema";

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: Omit<Student, 'id'>) => void;
  student: Student | null;
  sessions: { id: string; name: string }[];
  currentSessionId?: string;
  userRole?: string;
}

export default function StudentFormModal({
  isOpen,
  onClose,
  onSave,
  student,
  sessions = [],
  currentSessionId,
  userRole
}: StudentFormModalProps) {
  const [formData, setFormData] = useState({
    admissionNumber: '',
    name: '',
    dateOfBirth: '',
    admissionDate: '',
    aadharNumber: '',
    penNumber: '',
    aaparId: '',
    mobileNumber: '',
    address: '',
    grade: '',
    section: '',
    sessionId: currentSessionId || '',
    fatherName: '',
    motherName: '',
    yearlyFeeAmount: '',
    category: 'GEN',
    gender: 'Male',
    previousYearDue: '',
    transportFee: '',
    isRTE: false
  });

  useEffect(() => {
    if (student) {
      setFormData({
        admissionNumber: student.admissionNumber,
        name: student.name,
        dateOfBirth: student.dateOfBirth,
        admissionDate: student.admissionDate,
        aadharNumber: student.aadharNumber,
        penNumber: student.penNumber,
        aaparId: student.aaparId,
        mobileNumber: student.mobileNumber,
        address: student.address,
        grade: student.grade,
        section: student.section,
        sessionId: (student as any).sessionId || currentSessionId || '',
        fatherName: (student as any).fatherName || '',
        motherName: (student as any).motherName || '',
        yearlyFeeAmount: (student as any).yearlyFeeAmount,
        category: (student as any).category || 'GEN',
        gender: (student as any).gender || 'Male',
        previousYearDue: (student as any).previousYearDue || '',
        transportFee: (student as any).transportFee || '',
        isRTE: (student as any).isRTE || false
      });
    } else {
      setFormData({
        admissionNumber: '',
        name: '',
        dateOfBirth: '',
        admissionDate: '',
        aadharNumber: '',
        penNumber: '',
        aaparId: '',
        mobileNumber: '',
        address: '',
        grade: '',
        section: '',
        sessionId: currentSessionId || '',
        fatherName: '',
        motherName: '',
        yearlyFeeAmount: '',
        category: 'GEN',
        gender: 'Male',
        previousYearDue: '',
        transportFee: '',
        isRTE: false
      });
    }
  }, [student, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData };
    if (!payload.transportFee) payload.transportFee = '0';
    if (!payload.previousYearDue) payload.previousYearDue = '0'; // also good practice
    onSave(payload as any);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? 'Edit Student' : 'Add New Student'}</DialogTitle>
          <DialogDescription>
            {student ? 'Update student information' : 'Enter comprehensive student details'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            {/* Personal Information */}
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="text-sm font-semibold px-2">Personal Information</legend>
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="input-name"
                  placeholder="Enter student's full name"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    required
                    data-testid="input-dob"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={(formData as any).gender || 'Male'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value } as any)}
                    data-testid="input-gender"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={(formData as any).category || 'GEN'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value } as any)}
                    data-testid="input-category"
                  >
                    <option value="GEN">GEN</option>
                    <option value="OBC">OBC</option>
                    <option value="EWS">EWS</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <Input
                    id="fatherName"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    data-testid="input-father-name"
                    placeholder="Father's full name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="motherName">Mother's Name</Label>
                  <Input
                    id="motherName"
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    data-testid="input-mother-name"
                    placeholder="Mother's full name"
                  />
                </div>
              </div>
            </fieldset>

            {/* ID Numbers */}
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="text-sm font-semibold px-2">Identification Numbers</legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="admissionNumber">Admission Number</Label>
                  <Input
                    id="admissionNumber"
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                    required
                    data-testid="input-admission-number"
                    placeholder="STU001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="aadharNumber">Aadhar Number</Label>
                  <Input
                    id="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value })}
                    required
                    data-testid="input-aadhar"
                    placeholder="1234-5678-9012"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="penNumber">PEN Number</Label>
                  <Input
                    id="penNumber"
                    value={formData.penNumber}
                    onChange={(e) => setFormData({ ...formData, penNumber: e.target.value })}
                    required
                    data-testid="input-pen"
                    placeholder="PEN001234"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="aaparId">Aapar ID</Label>
                  <Input
                    id="aaparId"
                    value={formData.aaparId}
                    onChange={(e) => setFormData({ ...formData, aaparId: e.target.value })}
                    required
                    data-testid="input-aapar"
                    placeholder="AAP001"
                  />
                </div>
              </div>
            </fieldset>

            {/* Contact Details */}
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="text-sm font-semibold px-2">Contact Details</legend>
              <div className="grid gap-2">
                <Label htmlFor="mobileNumber">Mobile Number</Label>
                <Input
                  id="mobileNumber"
                  type="tel"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  required
                  data-testid="input-mobile"
                  placeholder="555-0101"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  data-testid="input-address"
                  placeholder="Street, City, State"
                />
              </div>
            </fieldset>

            {/* Academic Information */}
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="text-sm font-semibold px-2">Academic Information</legend>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="grade">Class</Label>
                  <Input
                    id="grade"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    required
                    data-testid="input-grade"
                    placeholder="10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="section">Section</Label>
                  <Input
                    id="section"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    required
                    data-testid="input-section"
                    placeholder="A"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admissionDate">Admission Date</Label>
                  <Input
                    id="admissionDate"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                    required
                    data-testid="input-admission-date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="session">Academic Session</Label>
                  <select
                    id="session"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={(formData as any).sessionId || ''}
                    onChange={(e) => setFormData({ ...formData, sessionId: e.target.value } as any)}
                    data-testid="input-session"
                    disabled={!!student} // Optional: Lock session on edit or allow transfer? User asked for "Add Student for session". Edit usually implies transfer which is complex. Let's allowing changing but it might need backend support. Actually onEditStudent calls PUT /api/students/:id. Does that update session? We need to check backend. For now, allow selection for new, maybe disabled for edit if unsure. Let's allow it, but backend might ignore it if not handled.
                  >
                    <option value="" disabled>Select Session</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Fee Information */}
            {/* Fee Information - Hidden for Teachers */}
            {/* Fee Information - Hidden for Teachers */}
            {(userRole !== 'teacher') && (
              <fieldset className="border rounded-lg p-4 space-y-4">
                <legend className="text-sm font-semibold px-2">Fee Information</legend>

                {/* RTE Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isRTE"
                    checked={(formData as any).isRTE || false}
                    onChange={(e) => {
                      const isRTE = e.target.checked;
                      setFormData({
                        ...formData,
                        isRTE,
                        // RTE only waives tuition fee, not transport fee
                        yearlyFeeAmount: isRTE ? '0' : formData.yearlyFeeAmount,
                      } as any);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="isRTE" className="cursor-pointer">
                    Right To Education (RTE) - Free Education
                  </Label>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="yearlyFeeAmount">Yearly Fee Amount (₹)</Label>
                  <Input
                    id="yearlyFeeAmount"
                    type="number"
                    value={formData.yearlyFeeAmount}
                    onChange={(e) => setFormData({ ...formData, yearlyFeeAmount: e.target.value })}
                    required
                    data-testid="input-yearly-fee"
                    placeholder="25000"
                    min="0"
                    step="1"
                    disabled={(formData as any).isRTE}
                    className={(formData as any).isRTE ? "bg-muted" : ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    Token fee amount to be collected for this academic year
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="previousYearDue">Previous Year Due (₹)</Label>
                  <Input
                    id="previousYearDue"
                    type="number"
                    value={(formData as any).previousYearDue}
                    onChange={(e) => setFormData({ ...formData, previousYearDue: e.target.value } as any)}
                    data-testid="input-previous-year-due"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Outstanding amount from previous academic years
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="transportFee">Transport Fee (₹)</Label>
                  <Input
                    id="transportFee"
                    type="number"
                    value={(formData as any).transportFee}
                    onChange={(e) => setFormData({ ...formData, transportFee: e.target.value } as any)}
                    data-testid="input-transport-fee"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional transport fee amount (applies to all students including RTE)
                  </p>
                </div>
              </fieldset>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" data-testid="button-save-student">
              {student ? 'Update' : 'Add'} Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
