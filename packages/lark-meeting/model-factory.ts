import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getModelProviders } from "./config-reader";

let _fastModel: LanguageModel | null = null;
let _proModel: LanguageModel | null = null;

function findModelName(models: string[], keyword: string): string {
  return models.find((m) => m.includes(keyword)) ?? models[0];
}

// 获取快速模型（用于分类、摘要等轻量任务）
export async function getFastModel(): Promise<LanguageModel> {
  if (_fastModel) return _fastModel;

  const providers = await getModelProviders();
  if (providers.length === 0) {
    throw new Error("模型未配置：请在管理后台添加 LLM 提供商");
  }

  const provider = providers[0];
  const client = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.apiBase,
  });

  const modelName = findModelName(provider.models as string[], "flash");
  const model = client(modelName);
  if (!model) throw new Error(`模型 ${modelName} 不可用`);

  _fastModel = model;
  return _fastModel;
}

// 获取主力模型（用于复杂推理、内容生成）
export async function getTextModel(): Promise<LanguageModel> {
  if (_proModel) return _proModel;

  const providers = await getModelProviders();
  if (providers.length === 0) {
    throw new Error("模型未配置：请在管理后台添加 LLM 提供商");
  }

  const provider = providers[0];
  const client = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.apiBase,
  });

  const modelName = findModelName(provider.models as string[], "pro");
  const model = client(modelName);
  if (!model) throw new Error(`模型 ${modelName} 不可用`);

  _proModel = model;
  return _proModel;
}
