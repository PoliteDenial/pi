# Network egress

This build of Pi is for internal use. It sends prompts and code only to the inference server configured in `models.json`. It contains no telemetry, update checks, remote model catalogs, or upload commands.

## What is disabled

| Feature | State | Where to change it |
|---|---|---|
| Install/update telemetry, provider attribution headers, analytics opt-in | Removed | — |
| Startup version check and `pi update` self-update | Off | `VERSION_CHECK_ENABLED` in `src/utils/version-check.ts` |
| Startup package update check (npm/git) | Off; `pi update` still updates packages on request | `STARTUP_PACKAGE_UPDATE_CHECK_ENABLED` in `src/modes/interactive/interactive-mode.ts` |
| pi.dev remote model catalog | Removed | — |
| Built-in third-party providers (OpenAI, Anthropic, OpenRouter, Radius, ...) and their `/login` flows | Off | `ENABLED_BUILTIN_PROVIDERS` in `src/core/enabled-builtin-providers.ts` |
| `/share` (GitHub gist) and `/bug` (upload) | Commented out | `src/core/slash-commands.ts`, `src/modes/interactive/interactive-mode.ts` |
| Automatic `fd`/`rg` download from GitHub | Removed; install `fd` and `ripgrep` from the system package manager | — |

## Egress allowlist

Pi refuses HTTP and WebSocket connections to any host that is not on the allowlist in `src/core/egress-allowlist.ts`. Loopback (`localhost`, `127.0.0.1`, `::1`) is always allowed. A leading dot matches a domain and its subdomains:

```ts
export const ALLOWED_HOSTS: readonly string[] = [
	"inference.corp.example",
	".mcp.corp.example",
];
```

The list is compiled in. No setting or environment variable widens it, and `HTTPS_PROXY` does not bypass it, because the check runs on the destination host before any proxy is used. A blocked request fails with `Blocked outbound connection to <host> (not in egress allowlist)`.

The check runs in two places, so it holds in both Node and the Bun-compiled binary:

- the global undici dispatcher (Node `fetch`, undici `WebSocket`)
- wrappers around `globalThis.fetch` and `globalThis.WebSocket`

Add the inference server, internal MCP servers, and any other internal HTTP services to the list before building.

## Configure the inference server

Add the corporate endpoint as a custom provider in `~/.pi/agent/models.json`. Any supported API type works, for example `openai-completions`, `openai-responses`, `anthropic-messages`, or `bedrock-converse-stream`:

```json
{
  "providers": {
    "corp": {
      "baseUrl": "https://inference.corp.example/v1",
      "api": "openai-completions",
      "apiKey": "${CORP_INFERENCE_KEY}",
      "models": [{ "id": "corp-coder" }]
    }
  }
}
```

The `baseUrl` host must be on the allowlist.

## What the allowlist does not cover

These paths open network connections outside `fetch`, so the allowlist cannot see them. Restrict them at the network level (firewall, egress proxy, or an isolated environment; see [Run Pi safely](security.md)):

- **Child processes.** The `bash` tool can run `curl`, `git`, `ssh`, and anything else on the machine. `pi install` and `pi update` run `npm` and `git`; point them at an internal registry and Git host. Stdio MCP servers are separate processes.
- **AWS SDK.** The Bedrock API uses `node:https` directly. If you switch to Bedrock, use the company account and, ideally, a VPC endpoint.
- **Third-party extensions** that open raw sockets.

The allowlist stops Pi itself from contacting outside services. It does not stop a model-generated command from doing so.
