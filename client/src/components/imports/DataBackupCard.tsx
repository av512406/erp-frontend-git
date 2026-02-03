import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { getAuthHeaders } from "@/lib/auth";

interface DataBackupCardProps {
    onRestoreSuccess?: () => void;
}

export function DataBackupCard({ onRestoreSuccess }: DataBackupCardProps) {
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const restoreFileRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleDownloadBackup = async () => {
        try {
            const res = await fetch('/api/backup/export', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error("Failed to download backup");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `school_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast({ title: "Backup Downloaded", description: "Your school data has been saved." });
        } catch (e: any) {
            toast({ title: "Backup Error", description: e.message, variant: "destructive" });
        }
    };

    const handleRestoreBackup = async () => {
        if (!backupFile) return;
        setIsRestoring(true);
        try {
            const text = await backupFile.text();
            const json = JSON.parse(text);

            const res = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(json)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Restore failed");
            }

            toast({ title: "Restore Successful", description: "System data has been restored." });
            setRestoreDialogOpen(false);
            if (onRestoreSuccess) onRestoreSuccess();
            // Optional: window.location.reload();
        } catch (e: any) {
            toast({ title: "Restore Error", description: e.message, variant: "destructive" });
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Backup & Restore</CardTitle>
                    <CardDescription>Download a full backup or restore from a previous JSON file.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Button onClick={handleDownloadBackup} variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Download Backup
                    </Button>
                    <Button onClick={() => setRestoreDialogOpen(true)} variant="outline">
                        <Upload className="mr-2 h-4 w-4" /> Restore Backup
                    </Button>
                </CardContent>
            </Card>

            <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore System Backup</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will overwrite current data with the backup. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label htmlFor="restore-file">Select Backup JSON</Label>
                        <Input
                            id="restore-file"
                            type="file"
                            accept=".json"
                            onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreBackup} disabled={!backupFile || isRestoring}>
                            {isRestoring ? "Restoring..." : "Confirm Restore"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
