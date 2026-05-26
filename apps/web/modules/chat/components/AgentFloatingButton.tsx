"use client";

import { MessageCircle } from "lucide-react";
import { useAgent } from "./AgentProvider";

export function AgentFloatingButton() {
	const { isOpen, togglePanel } = useAgent();

	return (
		<button
			type="button"
			onClick={togglePanel}
			className={`
        fixed bottom-6 right-6 z-50
        w-12 h-12 rounded-full
        flex items-center justify-center
        bg-white border-0
        shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]
        hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]
        transition-all duration-300 ease-in-out
        hover:scale-105
        ${isOpen ? "opacity-0 pointer-events-none" : "opacity-100"}
      `}
			aria-label="打开 AI 助手"
		>
			<MessageCircle className="w-5 h-5 text-gray-700" />
		</button>
	);
}
