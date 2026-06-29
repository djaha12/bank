import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-radial-glow px-6 text-center">
      <div className="space-y-4">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          This page doesn&apos;t exist in the NEO BANK OS sandbox.
        </p>
        <Button asChild variant="gradient">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
