import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import type { Student } from "@/types";

export function useStudentMutations() {
    const queryClient = useQueryClient();

    const addStudent = useMutation({
        mutationFn: async (student: Omit<Student, 'id'>) => {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(student)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to add student');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        }
    });

    const updateStudent = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Omit<Student, 'id'> }) => {
            // We need to fetch the existing student to get admissionNumber if not provided, 
            // but typically we should have it. The App.tsx logic fetched existing to construct URL.
            // Let's assume we pass the correct ID/AdmissionNumber or handle the URL construction here.
            // App.tsx: 
            // const endpoint = existing ? `/api/students/${existing.admissionNumber}` : `/api/students/by-id/${id}`;
            // Ideally we should just use ID if backend supports it, or we rely on caller to pass admissionNumber if that's the key.
            // Based on App.tsx, we'll try by-id if we don't have admissionNumber, but let's stick to what App.tsx did 
            // or improve it. `data` likely has admissionNumber.

            const endpoint = data.admissionNumber
                ? `/api/students/${encodeURIComponent(data.admissionNumber)}`
                : `/api/students/by-id/${encodeURIComponent(id)}`;

            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to update student');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        }
    });

    const deleteStudent = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to delete student');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        }
    });

    const markWithdrawn = useMutation({
        mutationFn: async ({ admissionNumber, payload, sessionId }: { admissionNumber: string; payload: { leftDate?: string; reason?: string }; sessionId?: string }) => {
            // Try preferred endpoint first
            let res = await fetch(`/api/students/${encodeURIComponent(admissionNumber)}/withdraw`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ ...payload, sessionId })
            });

            // Fallback
            if (!res.ok) {
                res = await fetch(`/api/students/${encodeURIComponent(admissionNumber)}/leave`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to mark as withdrawn');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['students', 'withdrawn'] });
        }
    });

    const restoreStudent = useMutation({
        mutationFn: async (admissionNumber: string) => {
            const res = await fetch(`/api/students/${encodeURIComponent(admissionNumber)}/restore`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to restore student');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['students', 'withdrawn'] });
        }
    });

    return {
        addStudent,
        updateStudent,
        deleteStudent,
        markWithdrawn,
        restoreStudent
    };
}
