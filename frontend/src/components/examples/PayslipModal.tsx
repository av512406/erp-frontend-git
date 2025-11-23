import { useState } from 'react';
import PayslipModal from '../PayslipModal';
import { Button } from '@/components/ui/button';
import type { FeeTransaction } from '../FeesPage';

export default function PayslipModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  const mockTransaction: FeeTransaction = {
    id: Date.now().toString(),
    studentId: '1',
    studentName: 'Student 1',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    transactionId: `EX-${Date.now().toString().slice(-6)}`
  };

  return (
    <div className="p-6">
      <Button onClick={() => setIsOpen(true)}>View Payslip</Button>
      <PayslipModal
        transaction={mockTransaction}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}
