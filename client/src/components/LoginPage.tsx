import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
  errorMessage?: string;
}

export default function LoginPage({ onLogin, errorMessage }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Frontend validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Wait, let's just let it pass if it's 'admin' (legacy) or ensure it matches email.
    // The user rules say: "our username is in the format username@schoolname.com".
    if (!emailRegex.test(email)) {
      // We can't use 'toast' here easily as it's not imported (though it is in AdminSettings).
      // Let's import useToast if possible, or just add a simple check.
      // The prompt requested "frontend side validation".
      alert("Please enter a valid username in the format username@schoolname.com");
      return;
    }

    onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">School ERP System</CardTitle>
            <CardDescription>Sign in to access your dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" data-testid="label-email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" data-testid="label-password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>
            {errorMessage && (
              <div className="text-sm text-destructive text-center font-medium">
                {errorMessage}
              </div>
            )}
            <Button type="submit" className="w-full" data-testid="button-login">
              Sign In
            </Button>
          </form>

        </CardContent>
      </Card>
    </div>
  );
}
