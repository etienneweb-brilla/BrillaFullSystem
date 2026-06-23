import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { can, type Section } from "@/lib/rbac";
import { logoutAction } from "@/app/actions";

const NAV: { href: string; label: string; section: Section }[] = [
  { href: "/dashboard", label: "Dashboard", section: "dashboard" },
  { href: "/workorders", label: "Work Orders", section: "workorders" },
  { href: "/services", label: "Service Builder", section: "services" },
  { href: "/clients", label: "Clients", section: "clients" },
  { href: "/properties", label: "Properties", section: "properties" },
  { href: "/staff", label: "Staff", section: "staff" },
  { href: "/invoices", label: "Invoices", section: "invoices" },
  { href: "/settings", label: "Settings", section: "settings" },
];

export default function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const items = NAV.filter((n) => can(user, n.section));

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-gray-200 bg-white print:hidden lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <Link href="/dashboard" className="text-lg font-bold text-brand-dark">
            Brilla Ops
          </Link>
          <p className="hidden text-xs text-gray-400 lg:mt-1 lg:block">Operations System</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-0">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-brand-dark"
            >
              {n.label}
            </Link>
          ))}
          {can(user, "mytasks") && (
            <Link
              href="/me"
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-brand-dark"
            >
              My Tasks
            </Link>
          )}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
          <div className="text-sm text-gray-500">
            {user.roleKeys.join(", ") || "user"}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{user.name}</span>
            <form action={logoutAction}>
              <button className="btn-secondary py-1.5 text-xs" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
