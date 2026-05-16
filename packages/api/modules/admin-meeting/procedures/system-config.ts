import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";
import { getConfig, setConfig } from "@repo/lark-meeting";

export const getSystemConfig = adminProcedure
  .route({
    method: "GET",
    path: "/admin/settings",
    tags: ["Admin - Config"],
    summary: "获取系统配置",
  })
  .handler(async () => {
    const [memberMode, feishuAppId] = await Promise.all([
      getConfig("member_access_mode"),
      getConfig("feishu_app_id"),
    ]);
    return {
      memberAccessMode: memberMode ?? "open",
      feishuAppId: feishuAppId ?? null,
    };
  });

export const updateSystemConfig = adminProcedure
  .route({
    method: "PATCH",
    path: "/admin/settings",
    tags: ["Admin - Config"],
    summary: "更新系统配置",
  })
  .input(
    z.object({
      memberAccessMode: z.enum(["open", "whitelist"]).optional(),
      feishuAppId: z.string().optional(),
      feishuAppSecret: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    if (input.memberAccessMode) {
      await setConfig("member_access_mode", input.memberAccessMode);
    }
    if (input.feishuAppId) {
      await setConfig("feishu_app_id", input.feishuAppId);
    }
    if (input.feishuAppSecret) {
      await setConfig("feishu_app_secret", input.feishuAppSecret);
    }
    return { success: true };
  });
