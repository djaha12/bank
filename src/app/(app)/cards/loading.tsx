import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CardsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="aspect-[1.586/1] w-full max-w-sm rounded-2xl" />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-md" />
                <Skeleton className="h-8 w-28 rounded-md" />
                <Skeleton className="h-8 w-36 rounded-md" />
              </div>
              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <Skeleton className="h-9 w-40" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((__, k) => (
                  <Skeleton key={k} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
