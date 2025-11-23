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
}

export default function StudentFormModal({
  isOpen,
  onClose,
  onSave,
  student
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
    fatherName: '',
    motherName: '',
    yearlyFeeAmount: ''
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
        fatherName: (student as any).fatherName || '',
        motherName: (student as any).motherName || '',
        yearlyFeeAmount: student.yearlyFeeAmount
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
        fatherName: '',
        motherName: '',
        yearlyFeeAmount: ''
      });
    }
  }, [student, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
              </div>
            </fieldset>

            {/* Fee Information */}
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="text-sm font-semibold px-2">Fee Information</legend>
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
                />
                <p className="text-xs text-muted-foreground">
                  Total fee amount to be collected for this academic year
                </p>
              </div>
            </fieldset>
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
