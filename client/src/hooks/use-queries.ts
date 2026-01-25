import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import type { Student } from "@shared/schema";
import type { FeeTransaction } from "@/components/FeesPage"; // Import types if available, or redefine
import type { GradeEntry } from "@/components/GradesPage";

// Types (mirrored from App.tsx or Schema)
// Ideally these should be imported from a shared type definition file

export function useStudents(sessionId?: string) {
    return useQuery<Student[]>({
        queryKey: ['students', sessionId],
        queryFn: async () => {
            const url = sessionId
                ? `/api/students?sessionId=${sessionId}`
                : `/api/students`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch students');
            const data = await res.json();
            // Handle paginated response { data: [], meta: ... } or simple array []
            if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
                return data.data;
            }
            return Array.isArray(data) ? data : [];
        },
        enabled: true // Always enabled, but we could gate it if sessionId is required
    });
}

export function useWithdrawnStudents() {
    return useQuery<Student[]>({
        queryKey: ['students', 'withdrawn'],
        queryFn: async () => {
            const res = await fetch('/api/students/withdrawn', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch withdrawn students');
            return res.json();
        }
    });
}

export function useFees(sessionId?: string) {
    return useQuery<FeeTransaction[]>({
        queryKey: ['fees', sessionId],
        queryFn: async () => {
            const queryParams = sessionId ? `?sessionId=${sessionId}` : '';
            const res = await fetch(`/api/fees${queryParams}`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch fees');
            const data = await res.json();
            if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
                return data.data;
            }
            return Array.isArray(data) ? data : [];
        }
    });
}

export function useGrades(sessionId?: string) {
    return useQuery<GradeEntry[]>({
        queryKey: ['grades', sessionId],
        queryFn: async () => {
            const queryParams = sessionId ? `?sessionId=${sessionId}` : '';
            const res = await fetch(`/api/grades${queryParams}`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch grades');
            const data = await res.json();
            if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
                return data.data;
            }
            return Array.isArray(data) ? data : [];
        }
    });
}
