"use client";

import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useState,
} from "react";

interface AgentState {
	isOpen: boolean;
	openPanel: () => void;
	closePanel: () => void;
	togglePanel: () => void;
	pendingQuery: string | null;
	triggerQuery: (query: string) => void;
	consumeQuery: () => string | null;
}

const AgentContext = createContext<AgentState>({
	isOpen: false,
	openPanel: () => {},
	closePanel: () => {},
	togglePanel: () => {},
	pendingQuery: null,
	triggerQuery: () => {},
	consumeQuery: () => null,
});

export function useAgent() {
	return useContext(AgentContext);
}

export function AgentProvider({ children }: PropsWithChildren) {
	const [isOpen, setIsOpen] = useState(false);
	const [pendingQuery, setPendingQuery] = useState<string | null>(null);

	const openPanel = useCallback(() => setIsOpen(true), []);
	const closePanel = useCallback(() => setIsOpen(false), []);
	const togglePanel = useCallback(() => setIsOpen((v) => !v), []);
	const triggerQuery = useCallback((query: string) => {
		setPendingQuery(query);
		setIsOpen(true);
	}, []);
	const consumeQuery = useCallback(() => {
		const q = pendingQuery;
		setPendingQuery(null);
		return q;
	}, [pendingQuery]);

	return (
		<AgentContext.Provider
			value={{
				isOpen,
				openPanel,
				closePanel,
				togglePanel,
				pendingQuery,
				triggerQuery,
				consumeQuery,
			}}
		>
			{children}
		</AgentContext.Provider>
	);
}
