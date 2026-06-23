import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

// Lightweight self-hosted session auth (email + password). No external service or
// API keys required. The session is a signed JWT stored in an httpOnly cookie.

const COOKIE_NAME = "brilla_session";
const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set. Add it to your .env file.");
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roleKeys: string[];
  permissions: Record<string, boolean>;
  staffProfileId: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Validate credentials and create a session cookie. Returns the user or null. */
export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { roles: { include: { role: true } }, staffProfile: true },
  });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const sessionUser = toSessionUser(user);
  const token = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return sessionUser;
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Returns the current session user, or null if not logged in. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    userId = payload.sub as string;
  } catch {
    return null;
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } }, staffProfile: true },
  });
  if (!user || !user.active) return null;
  return toSessionUser(user);
}

/** Require a logged-in user; redirect to login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

type UserWithRoles = NonNullable<Awaited<ReturnType<typeof db.user.findUnique>>> & {
  roles: { role: { key: string; permissions: string } }[];
  staffProfile: { id: string } | null;
};

function toSessionUser(user: UserWithRoles): SessionUser {
  const roleKeys = user.roles.map((r) => r.role.key);
  const permissions: Record<string, boolean> = {};
  for (const r of user.roles) {
    try {
      Object.assign(permissions, JSON.parse(r.role.permissions || "{}"));
    } catch {
      /* ignore malformed permissions */
    }
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleKeys,
    permissions,
    staffProfileId: user.staffProfile?.id ?? null,
  };
}
