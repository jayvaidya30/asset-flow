import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { setSession } from "@/lib/session";
import { handle, ok, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = handle(async (req) => {
  const { email, password } = schema.parse(await req.json());

  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee || employee.status === "INACTIVE") {
    return fail("Invalid credentials", 401);
  }
  if (!(await verifyPassword(password, employee.passwordHash))) {
    return fail("Invalid credentials", 401);
  }

  await setSession({
    sub: employee.id,
    email: employee.email,
    role: employee.role,
    name: employee.name,
  });
  await logActivity(employee.id, "LOGIN", "Employee", employee.id);

  return ok({ id: employee.id, name: employee.name, role: employee.role });
});
