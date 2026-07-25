import { Search, SlidersHorizontal, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DataTableFilters({
  placeholder = "Rechercher…",
  right,
}: {
  placeholder?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-10 bg-card pl-9" placeholder={placeholder} />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-10 bg-card">
          <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Filtres
        </Button>
        <Button variant="outline" size="sm" className="h-10 bg-card">
          <Download className="mr-1.5 h-3.5 w-3.5" /> Exporter
        </Button>
        {right}
      </div>
    </div>
  );
}