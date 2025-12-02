import { useState, useEffect } from "react";
import { GraduationCap } from "lucide-react";

interface SchoolLogoProps {
    url?: string | null;
    name?: string;
    className?: string;
    fallbackClassName?: string;
}

export function SchoolLogo({ url, name, className = "h-10 w-10", fallbackClassName = "w-10 h-10" }: SchoolLogoProps) {
    const [error, setError] = useState(false);

    // Reset error state if url changes
    useEffect(() => {
        setError(false);
    }, [url]);

    if (url && !error) {
        return (
            <img
                src={url}
                alt="Logo"
                className={`${className} object-contain rounded`}
                onError={() => setError(true)}
            />
        );
    }

    return (
        <div className={`${fallbackClassName} bg-primary rounded-md flex items-center justify-center`}>
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
    );
}
