/**
 * Internal build: built-in third-party providers are disabled so code can only reach the corporate
 * inference server, configured as a custom provider in models.json (any API type works there).
 * Uncomment a provider to re-enable it, and add its API host to ALLOWED_HOSTS in egress-allowlist.ts.
 */
const ENABLED_BUILTIN_PROVIDERS: readonly string[] = [
	// "amazon-bedrock",
	// "ant-ling",
	// "anthropic",
	// "azure",
	// "baseten",
	// "cerebras",
	// "cloudflare-ai-gateway",
	// "cloudflare-workers-ai",
	// "deepseek",
	// "fireworks",
	// "github-copilot",
	// "google",
	// "google-vertex",
	// "groq",
	// "huggingface",
	// "kimi-coding",
	// "meta",
	// "minimax",
	// "minimax-cn",
	// "mistral",
	// "moonshotai",
	// "moonshotai-cn",
	// "nvidia",
	// "openai",
	// "openai-codex",
	// "opencode",
	// "opencode-go",
	// "openrouter",
	// "qwen-token-plan",
	// "qwen-token-plan-cn",
	// "qwen-token-plan-individual",
	// "radius",
	// "together",
	// "typesafe",
	// "vercel-ai-gateway",
	// "xai",
	// "xiaomi",
	// "xiaomi-token-plan-ams",
	// "xiaomi-token-plan-cn",
	// "xiaomi-token-plan-sgp",
	// "zai",
	// "zai-coding-cn",
];

export function isBuiltinProviderEnabled(providerId: string): boolean {
	return ENABLED_BUILTIN_PROVIDERS.includes(providerId);
}
