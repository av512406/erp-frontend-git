import { useQuery } from "@tanstack/react-query";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";

export interface DocumentTemplate {
    id: string;
    type: string;
    content: string;
    config: string | null;
}

export function useDocumentTemplate(type: 'report_card' | 'transfer_certificate' | 'payslip') {
    const { config } = useSchoolConfig();

    // We need the school ID to fetch the template. 
    // Assuming useSchoolConfig provides it or we can derive it.
    // If useSchoolConfig doesn't provide ID, we might need to fetch it or rely on the backend to infer it from the user's session.
    // However, the API route is /api/schools/:schoolId/templates/:type.
    // Let's assume for now we can get the school ID from the user object or similar.
    // Actually, looking at useSchoolConfig, it returns the config object which might not have the ID if it's just metadata.
    // But wait, the backend routes use :schoolId. 
    // Let's check if we have a way to get the current user's school ID.
    // The 'user' object in App.tsx has schoolId. We might need to pass it or access it via context.
    // For simplicity, let's assume we can fetch the template for the *current* user's school via a simplified endpoint 
    // OR we update the API to use the session's school ID if :schoolId is 'current'.

    // Let's try to fetch using 'current' as schoolId and handle it in the backend if needed, 
    // OR better, let's look at how other components get the school ID.
    // It seems most components rely on the backend to scope data by the user's school.
    // But the new API explicitly asks for schoolId.
    // Let's update the API to allow 'current' or just use the session.
    // Actually, the previous step added /api/schools/:schoolId/templates/:type.
    // We can probably get the schoolId from the user context if we had one.
    // Let's assume for now we can use a placeholder or modify the API to be /api/templates/:type and infer school from session.

    // REVISION: I will modify the API to be /api/templates/:type and infer school from session.
    // This is safer and easier for the frontend.

    return useQuery<DocumentTemplate>({
        queryKey: ['template', type],
        queryFn: async () => {
            const res = await fetch(`/api/templates/${type}`);
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
