import { useState } from 'react';
import FeesPage, { FeeTransaction } from '../FeesPage';
import type { Student } from '@shared/schema';

export default function FeesPageExample() {
  const mockStudents: Student[] = [];
  const [transactions, setTransactions] = useState<FeeTransaction[]>([]);

  const handleAddTransaction = (transaction: Omit<FeeTransaction, 'id' | 'transactionId'>) => {
    const newTransaction: FeeTransaction = {
      ...transaction,
      id: Date.now().toString(),
      transactionId: `EX-${Date.now().toString().slice(-6)}`
    };
    setTransactions(prev => [newTransaction, ...prev]);
    return newTransaction;
  };

  return (
    <FeesPage
      students={mockStudents}
      transactions={transactions}
      onAddTransaction={handleAddTransaction}
    />
  );
}
