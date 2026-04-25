import { Suspense } from "react";
import { LoginForm } from "@/components/app/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-ledger">Finance OS</p>
          <h1 className="mt-3 text-2xl font-semibold">Private finance cockpit</h1>
          <p className="mt-2 text-sm text-muted-ledger">Single-user access from environment credentials.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Card>
    </main>
  );
}
