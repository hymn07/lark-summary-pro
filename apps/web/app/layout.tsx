import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import "./globals.css";
import "cropperjs/dist/cropper.css";
import { config } from "@/config";

export const metadata: Metadata = {
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
	description:
		"以飞书为入口的 AI 会议纪要自动生成工具。开完会，纪要自动出现在指定文件夹里。",
	openGraph: {
		title: config.appName,
		description:
			"开完会，纪要自动出现在文件夹里。AI 会议纪要自动生成，开源自部署。",
		siteName: config.appName,
	},
};

export default function RootLayout({ children }: PropsWithChildren) {
	return children;
}
