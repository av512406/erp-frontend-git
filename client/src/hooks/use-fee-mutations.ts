import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import type { FeeTransaction } from "@/types";

export function useFeeMutations() {
    const queryClient = useQueryClient();

    const addTransaction = useMutation({
        mutationFn: async ({ transaction, sessionId }: { transaction: Omit<FeeTransaction, 'id' | 'transactionId'>, sessionId: string }) => {
            const res = await fetch('/api/fees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    studentId: transaction.studentId,
                    amount: String(transaction.amount),
                    paymentDate: transaction.date,
                    paymentMode: transaction.paymentMode || 'cash',
                    remarks: transaction.remarks || '',
                    sessionId: sessionId
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to record payment');
            }
            return res.json() as Promise<FeeTransaction>;
        },
        onSuccess: () => {
            // Invalidate all fees queries to be safe (or we could target specific session)
            queryClient.invalidateQueries({ queryKey: ['fees'] });
        }
    });

    const cancelTransaction = useMutation({
        mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
            const res = await fetch(`/api/fees/${id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ reason })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to cancel transaction');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fees'] });
        }
    });

    return {
        addTransaction,
        cancelTransaction
    };
}
