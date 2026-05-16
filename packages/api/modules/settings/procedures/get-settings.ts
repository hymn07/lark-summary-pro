import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";

export const getSettings = protectedProcedure
  .route({
    method: "GET",
    path: "/settings",
    tags: ["Settings"],
    summary: "获取当前用户设置",
  })
  .handler(async ({ context }) => {
    const settings = await db.userSettings.findUnique({
      where: { userId: context.user.id },
    });

    if (!settings) {
      // 首次访问，创建默认设置
      const created = await db.userSettings.create({
        data: { userId: context.user.id },
      });
      return created;
    }

    return settings;
  });
