import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { printReceipt } from './Receipt';
import type { FeeTransaction } from './FeesPage';
import type { Student } from '@shared/schema';
import { schoolConfig } from '@/lib/schoolConfig';

const CATEGORY_ORDER = [
  'Admission Fee',
  'Teaching Fee',
  'Exam. Fee',
  'Computer Fee',
  'Development',
  'Other Fee/Late Fee'
];

interface ReceiptDistributionModalProps {
  open: boolean;
  onClose: () => void;
  transaction: FeeTransaction | null;
  student: Student | null;
  // Optional summary numbers supplied by parent
  yearlyFeeAmount?: number;
  paidSoFar?: number; // cumulative INCLUDING current transaction
}

export default function ReceiptDistributionModal({ open, onClose, transaction, student, yearlyFeeAmount, paidSoFar }: ReceiptDistributionModalProps) {
  const [amounts, setAmounts] = useState<Record<string,string>>({});
  const [touched, setTouched] = useState(false);
  const [receiptSerial, setReceiptSerial] = useState<number | undefined>(transaction?.receiptSerial);

  // Initialize default distribution when transaction changes
  useEffect(() => {
    if (transaction) {
      const initial: Record<string,string> = {};
      CATEGORY_ORDER.forEach(c => { initial[c] = ''; });
      // Default behavior: put full amount into Teaching Fee; user can reallocate.
      if (transaction.amount) {
        initial['Teaching Fee'] = transaction.amount.toFixed(2);
      }
      setAmounts(initial);
      setTouched(false);
      setReceiptSerial(transaction.receiptSerial);
    }
  }, [transaction]);

  const numericAmounts = useMemo(() => CATEGORY_ORDER.map(c => ({ label: c, amount: parseFloat(amounts[c] || '0') || 0 })), [amounts]);
  const totalEntered = useMemo(() => numericAmounts.reduce((s,x)=>s+x.amount,0), [numericAmounts]);
  const targetTotal = transaction?.amount || 0;
  const diff = +(totalEntered - targetTotal).toFixed(2);
  const valid = targetTotal > 0 && Math.abs(diff) < 0.01 && numericAmounts.some(n => n.amount > 0);

  function handleAmountChange(label: string, value: string) {
    setAmounts(a => ({ ...a, [label]: value.replace(/[^0-9.]/g,'') }));
    setTouched(true);
  }

  function autoDistribute() {
    if (!transaction) return;
    const remaining = transaction.amount;
    // Simple even distribution across teaching/exam/computer/development if admission already set
    const baseCategories = ['Teaching Fee','Exam. Fee','Computer Fee','Development'];
    const slice = +(remaining / baseCategories.length).toFixed(2);
    const newMap: Record<string,string> = { ...amounts };
    baseCategories.forEach((c,i) => {
      // adjust final slice to account for rounding drift
      if (i === baseCategories.length - 1) {
        const allocated = slice * (baseCategories.length - 1);
        newMap[c] = (remaining - allocated).toFixed(2);
      } else {
        newMap[c] = slice.toFixed(2);
      }
    });
    newMap['Admission Fee'] = '0';
    newMap['Other Fee/Late Fee'] = '0';
    setAmounts(newMap);
    setTouched(true);
  }

  function fillRemainingInto(label: string) {
    if (!transaction) return;
    const already = CATEGORY_ORDER.filter(c => c !== label).reduce((s,c)=> s + (parseFloat(amounts[c]||'0')||0),0);
    const remaining = Math.max(transaction.amount - already, 0);
    setAmounts(a => ({ ...a, [label]: remaining.toFixed(2) }));
    setTouched(true);
  }

  async function handlePrint() {
    if (!valid || !transaction || !student) return;
    let serialToUse = receiptSerial;
    // Assign a serial if missing
    if (serialToUse == null) {
      try {
        const resp = await fetch(`/api/fees/${transaction.id}/assign-serial`, { method: 'POST' });
        if (resp.ok) {
          const data = await resp.json();
            serialToUse = data.receiptSerial;
            setReceiptSerial(serialToUse);
        }
      } catch {}
    }
    const items = numericAmounts.map(n => ({ label: n.label, amount: n.amount }));
    printReceipt({
      student: { name: student.name, fatherName: (student as any).fatherName || '', grade: student.grade, section: student.section, admissionNumber: student.admissionNumber },
      paymentDate: transaction.date.slice(0,10),
      items,
      session: schoolConfig.session,
      copies: 1,
      serial: serialToUse,
      yearlyFeeAmount: typeof yearlyFeeAmount === 'number' ? yearlyFeeAmount : undefined,
      paidSoFar: typeof paidSoFar === 'number' ? paidSoFar : undefined
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Distribute Amount for Receipt</DialogTitle>
        </DialogHeader>
        {transaction && student ? (
          <div className="space-y-5">
            <div className="text-sm">
              <p><strong>Student:</strong> {student.name} ({student.admissionNumber})</p>
              <p><strong>Transaction:</strong> {transaction.transactionId}</p>
              <p><strong>Receipt Serial:</strong> {receiptSerial != null ? String(receiptSerial).padStart(4,'0') : 'Not Assigned'}</p>
              <p><strong>Total Amount:</strong> ₹{transaction.amount.toFixed(2)}</p>
              {typeof yearlyFeeAmount === 'number' && typeof paidSoFar === 'number' && (
                <p><strong>Remaining After Payment:</strong> ₹{(yearlyFeeAmount - paidSoFar).toFixed(2)}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CATEGORY_ORDER.map(label => (
                <div key={label} className="space-y-1">
                  <Label htmlFor={`cat-${label}`}>{label}</Label>
                  <Input
                    id={`cat-${label}`}
                    type="text"
                    inputMode="decimal"
                    value={amounts[label] || ''}
                    placeholder="0"
                    onChange={e => handleAmountChange(label, e.target.value)}
                  />
                  <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => fillRemainingInto(label)}>Fill Remaining</Button>
                </div>
              ))}
            </div>
            <div className="text-sm font-medium flex justify-between">
              <span>Entered Total:</span>
              <span>₹{totalEntered.toFixed(2)}</span>
            </div>
            {!valid && touched && (
              <p className="text-xs text-red-600">Amounts must sum to ₹{targetTotal.toFixed(2)}. Difference: {diff > 0 ? '+' : ''}{diff.toFixed(2)}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={autoDistribute}>Auto Distribute</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => {
                // Admission only
                setAmounts(a => ({ ...a, 'Admission Fee': targetTotal.toFixed(2), 'Teaching Fee': '0', 'Exam. Fee':'0','Computer Fee':'0','Development':'0','Other Fee/Late Fee':'0' }));
                setTouched(true);
              }}>All Admission</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setAmounts(a => ({ ...a, 'Other Fee/Late Fee': targetTotal.toFixed(2), 'Teaching Fee': '0', 'Exam. Fee':'0','Computer Fee':'0','Development':'0','Admission Fee':'0' }));
                setTouched(true);
              }}>All Other</Button>
            </div>
          </div>
        ) : <p className="text-sm">Loading...</p>}
        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePrint} disabled={!valid}>Print Receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
