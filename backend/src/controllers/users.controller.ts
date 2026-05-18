import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  department: { select: { id: true, name: true } },
  _count: { select: { cards: true, transactions: true } },
} as const;

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: { id: "asc" } });
  res.json({ users });
}

export async function listDepartments(_req: Request, res: Response) {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  res.json({ departments });
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(4),
  role: z.enum(["ADMIN", "ACCOUNTANT", "USER"]).default("USER"),
  departmentId: z.number().int().optional().nullable(),
});

export async function createUser(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      departmentId: data.departmentId ?? null,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
    select: userSelect,
  });
  res.status(201).json({ user });
}

const updateSchema = createSchema.partial().omit({ password: true }).extend({
  password: z.string().min(4).optional(),
  active: z.boolean().optional(),
});

export async function updateUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  const data = updateSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id },
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      active: data.active,
      departmentId: data.departmentId ?? undefined,
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
    select: userSelect,
  });
  res.json({ user });
}

export async function deleteUser(req: Request, res: Response) {
  await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { active: false },
  });
  res.json({ ok: true });
}
