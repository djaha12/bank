import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SavingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Hero summary */}
      <Card className="overflow-hidden p-8">
        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </Card>

      {/* Goal cards */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                {Array.from({ length: 2 }).map((__, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <Skeleton className="h-9 w-44" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
