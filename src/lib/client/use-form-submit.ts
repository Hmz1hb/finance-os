"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

type SubmitOptions<TBody, TResult> = {
  buildBody: (form: FormData) => TBody;
  url: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: TResult) => void;
  resetOnSuccess?: boolean;
};

type ApiErrorBody = { error?: string; issues?: Array<{ path: string; message: string }> };

function describeApiError(body: ApiErrorBody, fallback: string) {
  if (body.issues?.length) {
    return body.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
  }
  return body.error ?? fallback;
}

export function useFormSubmit<TBody = unknown, TResult = unknown>(options: SubmitOptions<TBody, TResult>) {
  const { buildBody, url, method = "POST", successMessage, errorMessage = "Request failed.", onSuccess, resetOnSuccess = true } = options;
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const body = buildBody(data);
    setSubmitting(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as ApiErrorBody & TResult;
      if (!response.ok) {
        toast.error(describeApiError(json, errorMessage));
        return;
      }
      if (resetOnSuccess) formElement.reset();
      if (successMessage) toast.success(successMessage);
      if (onSuccess) onSuccess(json as TResult);
      startTransition(() => {
        // caller is expected to call router.refresh() in onSuccess if needed
      });
    } catch {
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return { onSubmit, submitting };
}
