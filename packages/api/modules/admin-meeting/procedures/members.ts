import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const listMembers = adminProcedure
  .route({
    method: "GET",
    path: "/admin/members",
    tags: ["Admin - Members"],
    summary: "成员列表",
  })
  .handler(async () => {
    return db.user.findMany({
      select: { id: true, name: true, email: true, username: true, isAdmin: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  });

export const addMember = adminProcedure
  .route({
    method: "POST",
    path: "/admin/members",
    tags: ["Admin - Members"],
    summary: "添加成员",
  })
  .input(z.object({ email: z.string().email() }))
  .handler(async ({ input }) => {
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) return existing;

    return db.user.create({
      data: {
        name: input.email.split("@")[0],
        email: input.email,
        emailVerified: true,
      },
    });
  });

export const removeMember = adminProcedure
  .route({
    method: "DELETE",
    path: "/admin/members/:id",
    tags: ["Admin - Members"],
    summary: "移除成员",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    await db.userModelAccess.deleteMany({ where: { userId: input.id } });
    await db.userSettings.deleteMany({ where: { userId: input.id } });
    await db.user.delete({ where: { id: input.id } });
    return { success: true };
  });

export const updateMemberModels = adminProcedure
  .route({
    method: "PATCH",
    path: "/admin/members/:id/models",
    tags: ["Admin - Members"],
    summary: "更新成员模型分配",
  })
  .input(z.object({ id: z.string(), modelProviderIds: z.array(z.string()) }))
  .handler(async ({ input }) => {
    await db.userModelAccess.deleteMany({ where: { userId: input.id } });
    if (input.modelProviderIds.length > 0) {
      await db.userModelAccess.createMany({
        data: input.modelProviderIds.map((mpId) => ({
          userId: input.id,
          modelProviderId: mpId,
        })),
      });
    }
    return { success: true };
  });
