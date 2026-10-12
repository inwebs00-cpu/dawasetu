import { Badge, type BadgeVariant } from "@/components/ui/badge";

const statusVariants: Record<string, BadgeVariant> = {
  available: "success",
  active: "success",
  approved: "success",
  "low stock": "warning",
  pending: "warning",
  "out of stock": "destructive",
  rejected: "destructive",
  suspended: "destructive",
  inactive: "secondary",
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
  return (
    <Badge variant={statusVariants[normalized] ?? "outline"}>{status}</Badge>
  );
}
