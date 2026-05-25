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
    const [memberMode, feishuAppId, defaultFast, defaultText] = await Promise.all([
      getConfig("member_access_mode"),
      getConfig("feishu_app_id"),
      getConfig("default_fast_model"),
      getConfig("default_text_model"),
    ]);
    return {
      memberAccessMode: memberMode ?? "open",
      feishuAppId: feishuAppId ?? null,
      defaultFastModel: defaultFast ?? null,
      defaultTextModel: defaultText ?? null,
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
      defaultFastModel: z.string().optional(),
      defaultTextModel: z.string().optional(),
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
    if (input.defaultFastModel !== undefined) {
      await setConfig("default_fast_model", input.defaultFastModel);
    }
    if (input.defaultTextModel !== undefined) {
      await setConfig("default_text_model", input.defaultTextModel);
    }
    return { success: true };
  });
