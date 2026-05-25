import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@repo/database";
import type { LanguageModel } from "ai";
import { getConfig } from "./config-reader";

let _fastModel: LanguageModel | null = null;
let _fastModelKey: string | null = null;

let _textModel: LanguageModel | null = null;
let _textModelKey: string | null = null;

async function resolveModel(configKey: string): Promise<{ provider: { apiKey: string; apiBase: string }; modelName: string }> {
  const config = await getConfig(configKey);
  if (!config) {
    throw new Error(`未配置 ${configKey}，请在管理后台选择模型`);
  }

  const idx = config.indexOf(":");
  if (idx === -1) {
    throw new Error(`${configKey} 格式无效，应为 providerId:modelName`);
  }

  const providerId = config.slice(0, idx);
  const modelName = config.slice(idx + 1);

  const provider = await db.modelProvider.findUnique({ where: { id: providerId } });
  if (!provider) {
    throw new Error(`模型提供商（${providerId}）不存在或已删除，请在管理后台重新选择模型`);
  }

  return {
    provider: { apiKey: provider.apiKey, apiBase: provider.apiBase },
    modelName,
  };
}

function createClient(apiKey: string, apiBase: string, modelName: string): LanguageModel {
  const client = createOpenAI({
    apiKey,
    baseURL: apiBase,
    compatibility: "compatible",
  });
  const model = client.chat(modelName);
  if (!model) throw new Error(`模型 ${modelName} 不可用`);
  return model;
}

// 获取快速模型（用于前置路由等轻量任务）
export async function getFastModel(): Promise<LanguageModel> {
  const { provider, modelName } = await resolveModel("default_fast_model");
  const cacheKey = `${provider.apiBase}:${modelName}`;

  if (_fastModel && _fastModelKey === cacheKey) return _fastModel;

  _fastModel = createClient(provider.apiKey, provider.apiBase, modelName);
  _fastModelKey = cacheKey;
  return _fastModel;
}

// 获取主力模型（用于生成纪要等核心任务）
export async function getTextModel(): Promise<LanguageModel> {
  const { provider, modelName } = await resolveModel("default_text_model");
  const cacheKey = `${provider.apiBase}:${modelName}`;

  if (_textModel && _textModelKey === cacheKey) return _textModel;

  _textModel = createClient(provider.apiKey, provider.apiBase, modelName);
  _textModelKey = cacheKey;
  return _textModel;
}
