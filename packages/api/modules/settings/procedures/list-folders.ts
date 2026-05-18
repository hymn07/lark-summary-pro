import { db } from "@repo/database";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../../../orpc/procedures";

// 获取用户飞书文件夹列表（供文件夹选择器使用）
export const listFolders = protectedProcedure
  .route({
    method: "GET",
    path: "/settings/folders",
    tags: ["Settings"],
    summary: "获取用户飞书文件夹列表",
  })
  .handler(async ({ context }) => {
    // 获取用户的飞书 access token
    const account = await db.account.findFirst({
      where: { userId: context.user.id, providerId: "lark" },
    });
    if (!account?.accessToken) {
      throw new ORPCError("UNAUTHORIZED", { message: "无法获取飞书用户凭证，请重新登录" });
    }

    // 获取用户云空间根目录下的文件夹
    const res = await fetch(
      "https://open.feishu.cn/open-apis/drive/v1/files?page_size=50&folder_token=&direction=asc",
      {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      },
    );

    if (!res.ok) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "获取文件夹列表失败" });
    }

    const json = await res.json();
    const files = (json.data?.files ?? []).map((f: Record<string, unknown>) => ({
      token: f.token as string,
      name: f.name as string,
      type: f.type as string,
    }));

    return files;
  });
