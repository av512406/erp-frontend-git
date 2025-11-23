import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StudentsExcelExportModalProps {
  open: boolean;
  onClose: () => void;
}

const COLUMN_OPTIONS: { key: string; label: string; default?: boolean }[] = [
  { key: 'admissionNumber', label: 'Admission Number', default: true },
  { key: 'name', label: 'Name', default: true },
  { key: 'grade', label: 'Class', default: true },
  { key: 'section', label: 'Section', default: true },
  { key: 'fatherName', label: "Father's Name" },
  { key: 'motherName', label: "Mother's Name" },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'admissionDate', label: 'Admission Date' },
  { key: 'aadharNumber', label: 'Aadhar Number' },
  { key: 'penNumber', label: 'PEN Number' },
  { key: 'aaparId', label: 'Aapar ID' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'address', label: 'Address' },
  { key: 'yearlyFeeAmount', label: 'Yearly Fee Amount' },
  { key: 'status', label: 'Status' },
  { key: 'leftDate', label: 'Left Date' },
  { key: 'leavingReason', label: 'Leaving Reason' }
];

export default function StudentsExcelExportModal({ open, onClose }: StudentsExcelExportModalProps) {
  const [selected, setSelected] = useState<string[]>(COLUMN_OPTIONS.filter(c => c.default).map(c => c.key));
  const allSelected = selected.length === COLUMN_OPTIONS.length;

  const toggle = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const selectAll = () => setSelected(COLUMN_OPTIONS.map(c => c.key));
  const clearAll = () => setSelected([]);

  const handleExport = () => {
    if (selected.length === 0) {
      alert('Select at least one column');
      return;
    }
    const colsParam = encodeURIComponent(selected.join(','));
    const url = `/api/export/students/excel?cols=${colsParam}`;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 15000);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Students (Excel)</DialogTitle>
          <DialogDescription>Select columns to include in the Excel file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>Select All</Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>Clear All</Button>
          </div>
          <ScrollArea className="h-64 w-full border rounded-md p-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COLUMN_OPTIONS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox
                    checked={selected.includes(col.key)}
                    onCheckedChange={() => toggle(col.key)}
                    data-testid={`student-export-col-${col.key}`}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-students-excel">Cancel</Button>
            <Button onClick={handleExport} data-testid="button-confirm-students-excel">Export {selected.length ? `(${selected.length})` : ''}</Button>
          </div>
          <p className="text-xs text-muted-foreground">File downloads as a real .xlsx Excel workbook (compatible with Excel / LibreOffice).</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}