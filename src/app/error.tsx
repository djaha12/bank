"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          An unexpected error occurred. Your data is safe — this is a sandbox.
        </p>
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}
