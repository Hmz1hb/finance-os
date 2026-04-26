"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid username or password.");
      return;
    }
    router.push(params.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} method="post" action="/login" className="space-y-4">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-ledger/15 text-blue-ledger-fg">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <label htmlFor="login-username" className="block text-sm font-medium">Username</label>
        <Input id="login-username" name="username" placeholder="Username" autoComplete="username" required />
      </div>
      <div className="space-y-1">
        <label htmlFor="login-password" className="block text-sm font-medium">Password</label>
        <Input id="login-password" name="password" placeholder="Password" type="password" autoComplete="current-password" required />
      </div>
      {error ? <p className="text-sm text-red-risk">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
