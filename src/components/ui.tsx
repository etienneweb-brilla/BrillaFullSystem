import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}

const STATUS_COLOURS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  partially_completed: "bg-amber-100 text-amber-700",
  on_hold: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  paid: "bg-green-100 text-green-700",
  invoiced: "bg-teal-100 text-teal-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  overdue: "bg-red-100 text-red-700",
  unpaid: "bg-gray-100 text-gray-700",
  partial: "bg-amber-100 text-amber-700",
  open: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOURS[status] ?? "bg-gray-100 text-gray-700";
  return <span className={`badge ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>;
}
