import { Sparkles } from "lucide-react";
import { cn } from "../lib";

export function Logo({
	withLabel = true,
	className,
}: {
	className?: string;
	withLabel?: boolean;
}) {
	const size = withLabel ? 28 : 22;
	const iconSize = withLabel ? 14 : 11;

	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<span
				className="shrink-0 flex items-center justify-center rounded-[10px] bg-gradient-to-br from-gray-800 to-gray-900"
				style={{ width: size, height: size }}
			>
				<Sparkles
					className="text-white shrink-0"
					style={{ width: iconSize, height: iconSize }}
					strokeWidth={2}
					aria-hidden="true"
				/>
			</span>
			{withLabel && (
				<span className="ml-2 text-base tracking-tight font-semibold whitespace-nowrap">
					Lark Summary Pro
				</span>
			)}
		</span>
	);
}
