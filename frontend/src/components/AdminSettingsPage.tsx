import React, { useState } from 'react';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export default function AdminSettingsPage() {
  const { config, isLoading, updateConfig, isSaving } = useSchoolConfig();
  const [form, setForm] = useState({
    name: config.name,
    addressLine: config.addressLine,
    phone: config.phone,
    session: config.session,
    logoFile: null as File | null
  });

  const [logoError, setLogoError] = useState<string | null>(null);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const { name, value, files } = e.target;
    if (name === 'logoFile' && files) {
      const file = files[0];
      if (file) {
        // Enforce max size ~300KB to prevent oversized base64 payloads
        if (file.size > 300 * 1024) {
          setLogoError('Logo too large. Please use an image under 300KB.');
          setForm(f => ({ ...f, logoFile: null }));
        } else {
          setLogoError(null);
          setForm(f => ({ ...f, logoFile: file }));
        }
      }
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateConfig(form);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>School Settings</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isLoading && <p className="text-sm text-muted-foreground">Loading current configuration...</p>}
            <div className="space-y-2">
              <Label htmlFor="name">School Name</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine">Address Line</Label>
              <Input id="addressLine" name="addressLine" value={form.addressLine} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session">Session</Label>
              <Input id="session" name="session" value={form.session} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoFile">Logo Image (optional)</Label>
              <Input id="logoFile" name="logoFile" type="file" accept="image/*" onChange={handleChange} />
              {config.logoUrl && <img src={config.logoUrl} alt="Current Logo" className="h-20 mt-2 object-contain border rounded" />}
              {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
              {!logoError && form.logoFile && <p className="text-xs text-muted-foreground mt-1">Selected: {form.logoFile.name} ({Math.round(form.logoFile.size/1024)} KB)</p>}
            </div>
            <div className="text-xs text-muted-foreground">Updating settings immediately affects receipts and other areas using school metadata.</div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Settings'}</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}