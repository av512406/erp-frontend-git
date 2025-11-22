import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Student } from '@shared/schema';

interface StudentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

export default function StudentViewModal({ isOpen, onClose, student }: StudentViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student Details</DialogTitle>
          <DialogDescription>Read-only profile information</DialogDescription>
        </DialogHeader>
        {student ? (
          <div className="space-y-6">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Detail label="Admission Number" value={student.admissionNumber} />
              <Detail label="Name" value={student.name} />
              <Detail label="Class" value={student.grade} />
              <Detail label="Section" value={student.section} />
              <Detail label="DOB" value={student.dateOfBirth} />
              <Detail label="Admission Date" value={student.admissionDate} />
              <Detail label="Father's Name" value={(student as any).fatherName || ''} />
              <Detail label="Mother's Name" value={(student as any).motherName || ''} />
            </section>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Detail label="Mobile" value={student.mobileNumber} />
              <Detail label="Address" value={student.address} />
              <Detail label="Aadhar" value={student.aadharNumber} />
              <Detail label="PEN" value={student.penNumber} />
              <Detail label="Aapar ID" value={student.aaparId} />
              <Detail label="Yearly Fee" value={`₹${(Number(student.yearlyFeeAmount)||0).toLocaleString('en-IN')}`} />
            </section>
            {student.status === 'left' && (
              <section className="border rounded-md p-3 bg-muted/30">
                <p className="text-sm font-medium mb-1">Withdrawal Info</p>
                <p className="text-xs text-muted-foreground">Left Date: {student.leftDate || '—'}</p>
                <p className="text-xs text-muted-foreground">Reason: {student.leavingReason || '—'}</p>
              </section>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose} data-testid="button-close-student-view">Close</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No student selected</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words" data-testid={`student-view-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}>{value || '—'}</p>
    </div>
  );
}