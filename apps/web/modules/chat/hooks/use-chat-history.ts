"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatSession {
	id: string;
	title: string;
	messages: unknown[];
	createdAt: string;
	updatedAt: string;
}

const STORAGE_KEY = "lark-summary-chat-sessions";
const MAX_SESSIONS = 20;
const SAVE_DEBOUNCE = 1000;

export function useChatHistory() {
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const currentId = useRef<string | null>(null);

	useEffect(() => {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			try {
				setSessions(JSON.parse(raw));
			} catch {
				/* ignore */
			}
		}
	}, []);

	const persist = useCallback((updated: ChatSession[]) => {
		setSessions(updated);
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify(updated.slice(0, MAX_SESSIONS)),
		);
	}, []);

	const startNewSession = useCallback(
		(title?: string) => {
			const id = `session_${Date.now()}`;
			currentId.current = id;
			const session: ChatSession = {
				id,
				title:
					title ?? `会话 ${new Date().toLocaleDateString("zh-CN")}`,
				messages: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			persist([session, ...sessions]);
			return id;
		},
		[sessions, persist],
	);

	const saveSession = useCallback((messages: unknown[]) => {
		if (!currentId.current || messages.length === 0) {
			return;
		}
		clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			setSessions((prev) => {
				const updated = prev.map((s) =>
					s.id === currentId.current
						? {
								...s,
								messages,
								updatedAt: new Date().toISOString(),
							}
						: s,
				);
				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify(updated.slice(0, MAX_SESSIONS)),
				);
				return updated;
			});
		}, SAVE_DEBOUNCE);
	}, []);

	const deleteSession = useCallback(
		(id: string) => {
			persist(sessions.filter((s) => s.id !== id));
		},
		[sessions, persist],
	);

	return { sessions, startNewSession, saveSession, deleteSession, currentId };
}
