import { Skeleton } from "@/components/ui/skeleton";

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border bg-card p-5"
        >
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-5 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="h-full w-full rounded-xl" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/40">
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="px-5 py-3">
              <Skeleton className="h-3 w-16" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r} className="border-b">
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c} className="px-5 py-3">
                <Skeleton className="h-3 w-full" style={{ maxWidth: c === 0 ? 120 : c === cols - 1 ? 80 : "100%" }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-5 py-3">
          <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

export function GenericPageSkeleton({
  kpis = 4,
  withChart = false,
  withTable = true,
  tableRows = 8,
  tableCols = 6,
  maxWidth = 1480,
}: {
  kpis?: number;
  withChart?: boolean;
  withTable?: boolean;
  tableRows?: number;
  tableCols?: number;
  maxWidth?: number;
}) {
  return (
    <div className="mx-auto" style={{ maxWidth }}>
      <PageHeaderSkeleton />
      {kpis > 0 && <KpiRowSkeleton count={kpis} />}
      {withChart && (
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <ChartSkeleton height={280} />
        </div>
      )}
      {withTable && (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <TableSkeleton rows={tableRows} cols={tableCols} />
        </div>
      )}
    </div>
  );
}
