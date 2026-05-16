import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";

export const listVersions = protectedProcedure
  .route({
    method: "GET",
    path: "/prompt-versions",
    tags: ["Prompt Versions"],
    summary: "获取当前用户的 Prompt 版本列表",
  })
  .handler(async ({ context }) => {
    return db.promptVersion.findMany({
      where: { createdById: context.user.id },
      orderBy: { createdAt: "desc" },
    });
  });
