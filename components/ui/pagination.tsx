import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = "pages",
}: PaginationProps) {
  const total = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-slate-600">
        Page <span className="font-semibold text-slate-900">{current}</span> of{" "}
        <span className="font-semibold text-slate-900">{total}</span> {label}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={current >= total}
          onClick={() => onPageChange(current + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
