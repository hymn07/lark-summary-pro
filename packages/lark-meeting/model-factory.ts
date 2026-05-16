import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getModelProviders } from "./config-reader";

let _fastModel: LanguageModel | null = null;
let _proModel: LanguageModel | null = null;

function findModelName(models: string[], keyword: string): string {
  return models.find((m) => m.includes(keyword)) ?? models[0];
}

function createModel(provider: { apiKey: string; apiBase: string; models: unknown }, keyword: string): LanguageModel {
  const client = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.apiBase,
    compatibility: "compatible",
  });

  const modelName = findModelName(provider.models as string[], keyword);
  console.log(`[ModelFactory] 创建模型: ${modelName} (${keyword}) baseURL: ${provider.apiBase}`);

  // 尝试 chat 模式（Chat Completions API）
  const model = client.chat(modelName);
  if (!model) throw new Error(`模型 ${modelName} 不可用`);
  return model;
}

// 获取快速模型（用于分类、摘要等轻量任务）
export async function getFastModel(): Promise<LanguageModel> {
  if (_fastModel) return _fastModel;

  const providers = await getModelProviders();
  if (providers.length === 0) {
    throw new Error("模型未配置：请在管理后台添加 LLM 提供商");
  }

  _fastModel = createModel(providers[0], "flash");
  return _fastModel;
}

// 获取主力模型（用于复杂推理、内容生成）
export async function getTextModel(): Promise<LanguageModel> {
  if (_proModel) return _proModel;

  const providers = await getModelProviders();
  if (providers.length === 0) {
    throw new Error("模型未配置：请在管理后台添加 LLM 提供商");
  }

  _proModel = createModel(providers[0], "pro");
  return _proModel;
}
