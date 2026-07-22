import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PlatformLoginForm } from "./login-form";

export default function PlatformLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>RKYS Süper Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformLoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
