import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { homePathFor } from "@/lib/rbac";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(homePathFor(user));
}
