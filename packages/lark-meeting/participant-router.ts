import { db, decryptField } from "@repo/database";
import type { MeetingDetail, PipelineContext } from "./types";

// 从参会人中筛选开启自动纪要的内部用户
export async function routeParticipants(
  detail: MeetingDetail,
): Promise<PipelineContext[]> {
  // 筛掉外部人
  const internalParticipants = detail.participants.filter((p) => !p.isExternal);

  if (internalParticipants.length === 0) {
    return [];
  }

  // 查找系统中已存在的用户（通过 open_id/user_id 匹配）
  // 单租户模式，直接查 user 表
  const userIds = internalParticipants.map((p) => p.userId);
  const users = await db.user.findMany({
    where: {
      OR: [
        { id: { in: userIds } }, // 飞书 open_id 可能直接存为 id
        { username: { in: userIds } },
      ],
    },
    include: {
      userSettings: true,
    },
  });

  // 降级：如果没有匹配到用户，可能是示例数据或参会人 ID 不匹配
  // 回退到所有开启了自动纪要的用户
  if (users.length === 0) {
    const fallbackUsers = await db.user.findMany({
      where: {
        userSettings: { autoEnabled: true },
      },
      include: { userSettings: true },
    });
    users.push(...fallbackUsers);
  }

  // 为每个开启了自动纪要的用户构建上下文
  const contexts: PipelineContext[] = [];

  for (const user of users) {
    const settings = user.userSettings;

    // 未开启自动纪要 → 跳过
    if (!settings?.autoEnabled) continue;

    // 获取用户的活跃 Prompt
    let corePrompt: string | null = null;
    if (settings.activePromptVersionId) {
      const version = await db.promptVersion.findUnique({
        where: { id: settings.activePromptVersionId },
      });
      corePrompt = version?.corePrompt ? decryptField(version.corePrompt) : null;
    }

    // 如果用户没有活跃版本，尝试获取管理员设置的默认版本
    if (!corePrompt) {
      const defaultVersion = await db.promptVersion.findFirst({
        where: { isDefault: true },
        orderBy: { createdAt: "desc" },
      });
      corePrompt = defaultVersion?.corePrompt ? decryptField(defaultVersion.corePrompt) : null;
    }

    contexts.push({
      meetingId: detail.id,
      userId: user.id,
      userSettings: {
        autoEnabled: settings.autoEnabled,
        saveFolderToken: settings.saveFolderToken,
        extraInstructions: settings.extraInstructions ?? null,
        activePromptVersionId: settings.activePromptVersionId,
      },
      corePrompt,
    });
  }

  return contexts;
}
