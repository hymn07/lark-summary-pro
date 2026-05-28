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
    const [memberMode, feishuAppId, defaultFast, defaultText, prefilter, generation, analysis, agent] = await Promise.all([
      getConfig("member_access_mode"),
      getConfig("feishu_app_id"),
      getConfig("default_fast_model"),
      getConfig("default_text_model"),
      getConfig("model_prefilter"),
      getConfig("model_generation"),
      getConfig("model_analysis"),
      getConfig("model_agent"),
    ]);
    return {
      memberAccessMode: memberMode ?? "open",
      feishuAppId: feishuAppId ?? null,
      defaultFastModel: defaultFast ?? null,
      defaultTextModel: defaultText ?? null,
      modelPrefilter: prefilter ?? '{"providerId":"deepseek","modelName":"deepseek-chat"}',
      modelGeneration: generation ?? '{"providerId":"deepseek","modelName":"deepseek-chat"}',
      modelAnalysis: analysis ?? '{"providerId":"deepseek","modelName":"deepseek-chat"}',
      modelAgent: agent ?? '{"providerId":"deepseek","modelName":"deepseek-chat"}',
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
      modelPrefilter: z.string().optional(),
      modelGeneration: z.string().optional(),
      modelAnalysis: z.string().optional(),
      modelAgent: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    if (input.memberAccessMode) await setConfig("member_access_mode", input.memberAccessMode);
    if (input.feishuAppId) await setConfig("feishu_app_id", input.feishuAppId);
    if (input.feishuAppSecret) await setConfig("feishu_app_secret", input.feishuAppSecret);
    if (input.defaultFastModel !== undefined) await setConfig("default_fast_model", input.defaultFastModel);
    if (input.defaultTextModel !== undefined) await setConfig("default_text_model", input.defaultTextModel);
    if (input.modelPrefilter !== undefined) await setConfig("model_prefilter", input.modelPrefilter);
    if (input.modelGeneration !== undefined) await setConfig("model_generation", input.modelGeneration);
    if (input.modelAnalysis !== undefined) await setConfig("model_analysis", input.modelAnalysis);
    if (input.modelAgent !== undefined) await setConfig("model_agent", input.modelAgent);
    return { success: true };
  });
