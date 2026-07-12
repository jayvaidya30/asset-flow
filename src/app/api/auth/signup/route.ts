import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { setSession } from "@/lib/session";
import { handle, ok, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";

// Signup ALWAYS creates a plain EMPLOYEE. Roles are only assigned by Admin in
// Org Setup (spec: "no self-assigned admin roles"). Do not accept a role here.
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = handle(async (req) => {
  const { name, email, password } = schema.parse(await req.json());

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) return fail("An account with that email already exists", 409);

  const employee = await prisma.employee.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "EMPLOYEE" },
  });

  await setSession({ sub: employee.id, email: employee.email, role: employee.role, name: employee.name });
  await logActivity(employee.id, "SIGNUP", "Employee", employee.id);

  return ok({ id: employee.id, name: employee.name, role: employee.role }, 201);
});
