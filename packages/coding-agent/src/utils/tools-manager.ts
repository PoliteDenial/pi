import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";
import { join } from "path";
import { getBinDir } from "../config.ts";

const TOOLS_DIR = getBinDir();

interface ToolConfig {
	name: string;
	binaryName: string;
	systemBinaryNames?: string[]; // Alternative system command names
	packageName: string;
}

const TOOLS: Record<string, ToolConfig> = {
	fd: { name: "fd", binaryName: "fd", systemBinaryNames: ["fd", "fdfind"], packageName: "fd" },
	rg: { name: "ripgrep", binaryName: "rg", packageName: "ripgrep" },
};

// Check if a command exists in PATH by trying to run it
function commandExists(cmd: string): boolean {
	try {
		const result = spawnSync(cmd, ["--version"], { stdio: "pipe" });
		// Check for ENOENT error (command not found)
		return result.error === undefined || result.error === null;
	} catch {
		return false;
	}
}

// Get the path to a tool (system-wide or in our tools dir)
export function getToolPath(tool: "fd" | "rg"): string | null {
	const config = TOOLS[tool];
	if (!config) return null;

	// Check our tools directory first
	const localPath = join(TOOLS_DIR, config.binaryName + (platform() === "win32" ? ".exe" : ""));
	if (existsSync(localPath)) {
		return localPath;
	}

	// Check system PATH - if found, just return the command name (it's in PATH)
	const systemBinaryNames = config.systemBinaryNames ?? [config.binaryName];
	for (const systemBinaryName of systemBinaryNames) {
		if (commandExists(systemBinaryName)) {
			return systemBinaryName;
		}
	}

	return null;
}

export interface ToolStatus {
	type: "info" | "warning";
	message: string;
}

/**
 * Find a tool installed locally. Never downloads.
 * Reports a missing tool through `onStatus`; status messages are otherwise silent.
 */
export async function ensureTool(
	tool: "fd" | "rg",
	onStatus?: (status: ToolStatus) => void,
): Promise<string | undefined> {
	const existingPath = getToolPath(tool);
	if (existingPath) return existingPath;
	const config = TOOLS[tool];
	if (config) {
		onStatus?.({
			type: "warning",
			message: `${config.name} not found. Install the "${config.packageName}" package or place ${config.binaryName} in ${TOOLS_DIR}.`,
		});
	}
	return undefined;
}
