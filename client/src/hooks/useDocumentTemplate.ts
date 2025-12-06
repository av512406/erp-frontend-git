
import { useQuery } from "@tanstack/react-query";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { getAuthHeaders } from "@/lib/auth";

export interface DocumentTemplate {
    id: string;
    type: string;
    content: string;
    config: string | null;
}

export function useDocumentTemplate(type: 'report_card' | 'transfer_certificate' | 'payslip') {
    const { config } = useSchoolConfig();

    return useQuery<DocumentTemplate>({
        queryKey: ['template', type],
        queryFn: async () => {
            const res = await fetch(`/ api / templates / ${type} `, { headers: getAuthHeaders() });
            if (!res.ok) {
                if (res.status === 404) return null;
                throw new Error('Failed to fetch template');
            }
            return res.json();
        },
        // Don't retry on 404, just return null so we can use default
        retry: (failureCount, error: any) => {
            if (error?.status === 404) return false;
            return failureCount < 3;
        }
    });
}
