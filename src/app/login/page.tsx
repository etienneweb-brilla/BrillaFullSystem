import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { homePathFor } from "@/lib/rbac";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user));

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-dark to-brand p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-dark">Brilla Operations</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
        </div>
        <LoginForm />
        <div className="mt-6 rounded-md bg-gray-50 p-3 text-xs text-gray-500">
          <p className="font-semibold text-gray-600">Demo logins (from seed):</p>
          <p>Admin — admin@brilla.local / admin123</p>
          <p>Cleaner — cleaner@brilla.local / cleaner123</p>
        </div>
      </div>
    </div>
  );
}
