import { db, encryptField } from "@repo/database";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "../../../orpc/procedures";

export const listProviders = adminProcedure
  .route({
    method: "GET",
    path: "/admin/model-providers",
    tags: ["Admin - Models"],
    summary: "模型提供商列表",
  })
  .handler(async ({ context }) => {
    return db.modelProvider.findMany({
      where: { createdById: context.user.id },
      orderBy: { createdAt: "desc" },
    });
  });

export const createProvider = adminProcedure
  .route({
    method: "POST",
    path: "/admin/model-providers",
    tags: ["Admin - Models"],
    summary: "添加模型提供商",
  })
  .input(
    z.object({
      name: z.string().min(1),
      apiBase: z.string().url(),
      apiKey: z.string().min(1),
      models: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ input, context }) => {
    return db.modelProvider.create({
      data: {
        name: input.name,
        apiBase: input.apiBase,
        apiKey: encryptField(input.apiKey),
        models: input.models,
        createdById: context.user.id,
      },
    });
  });

export const deleteProvider = adminProcedure
  .route({
    method: "DELETE",
    path: "/admin/model-providers/:id",
    tags: ["Admin - Models"],
    summary: "删除模型提供商",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const provider = await db.modelProvider.findUnique({ where: { id: input.id } });
    if (!provider) throw new ORPCError("NOT_FOUND");
    if (provider.createdById !== context.user.id) throw new ORPCError("FORBIDDEN");

    await db.userModelAccess.deleteMany({ where: { modelProviderId: input.id } });
    await db.modelProvider.delete({ where: { id: input.id } });
    return { success: true };
  });
