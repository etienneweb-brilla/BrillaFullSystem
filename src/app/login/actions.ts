"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";
import { homePathFor } from "@/lib/rbac";

export async function loginAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return "Please enter your email and password.";

  const user = await login(email, password);
  if (!user) return "Invalid email or password.";
  redirect(homePathFor(user));
}
