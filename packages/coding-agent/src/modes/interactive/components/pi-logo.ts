import { backgroundAnsi, foregroundAnsi, isAppleTerminalSession, rgbColor } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

const CORAL = rgbColor(228, 138, 122);
const YELLOW = rgbColor(234, 182, 93);
const RESET = "\x1b[0m";

type Color = typeof CORAL;

const JET_COLORS: Record<string, Color> = {
	B: rgbColor(160, 170, 182), // body
	W: rgbColor(98, 110, 124), // wing
	C: rgbColor(90, 190, 230), // canopy
	F: rgbColor(240, 140, 60), // afterburner
};

/**
 * Pixel-art fighter jet, nose to the right. Two pixel rows share one terminal line via half blocks.
 * The colors stay fixed across themes; they follow the terminal's color mode.
 */
const JET = ["BB..........", ".BBBBBBCC...", "FBBBBBBBBBBB", "....WWWW...."];

export function piLogoLines(): [string, string] {
	const mode = theme.getColorMode();
	const line = (upper: string, lower: string) =>
		[...upper]
			.map((key, i) => {
				const top = JET_COLORS[key];
				const bottom = JET_COLORS[lower[i]];
				if (!top && !bottom) return " ";
				if (!top) return `${foregroundAnsi(bottom, mode)}▄${RESET}`;
				if (!bottom || top === bottom) return `${foregroundAnsi(top, mode)}${top === bottom ? "█" : "▀"}${RESET}`;
				return `${foregroundAnsi(top, mode)}${backgroundAnsi(bottom, mode)}▀${RESET}`;
			})
			.join("");
	return [line(JET[0], JET[1]), line(JET[2], JET[3])];
}

/**
 * Whether the terminal renders the half-block logo correctly. Apple Terminal draws gaps between rows and
 * misaligns the half blocks, so it gets the text wordmark instead.
 */
export function supportsPiLogo(): boolean {
	return !isAppleTerminalSession();
}

/** Text fallback for the logo: "Pi" with the logo's coral and yellow. */
export function piWordmark(): string {
	const mode = theme.getColorMode();
	return `${foregroundAnsi(CORAL, mode)}P${RESET}${foregroundAnsi(YELLOW, mode)}i${RESET}`;
}
