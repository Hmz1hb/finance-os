"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
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

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes — sufficient entropy for a per-render dedupe key.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useFormSubmit<TBody = unknown, TResult = unknown>(options: SubmitOptions<TBody, TResult>) {
  const { buildBody, url, method = "POST", successMessage, errorMessage = "Request failed.", onSuccess, resetOnSuccess = true } = options;
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  // Per-render Idempotency-Key — stable across re-renders, regenerated on successful submit.
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());
  const dirtyRef = useRef(false);

  // Dirty-form beforeunload guard. Once any form input on the page is edited
  // we register interest in unload events; the flag clears on successful
  // submit (and the listeners detach on unmount). Detecting input at the
  // document level keeps this hook self-contained — consumers don't need to
  // forward an extra ref or onChange handler.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      // Some older browsers (and Safari) need returnValue set to a non-empty string.
      event.returnValue = "";
    }

    function markDirty(event: Event) {
      const target = event.target as Element | null;
      if (!target) return;
      // Only flip on real form-control input — ignore programmatic events on
      // unrelated nodes.
      if (target.closest("input, select, textarea")) {
        dirtyRef.current = true;
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
    };
  }, []);

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
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as ApiErrorBody & TResult;
      if (!response.ok) {
        toast.error(describeApiError(json, errorMessage));
        return;
      }
      if (resetOnSuccess) formElement.reset();
      // Successful submit clears the dirty flag and rotates the idempotency key
      // so the next submit from the same mounted form is a distinct request.
      dirtyRef.current = false;
      setIdempotencyKey(generateIdempotencyKey());
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
