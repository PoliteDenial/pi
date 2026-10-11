import type { Dispatcher } from "undici";

/**
 * Hosts pi may open HTTP/WebSocket connections to. Everything else is refused.
 * Edit this list and rebuild to change it; there is intentionally no runtime override.
 * Entries starting with "." match the domain and all its subdomains (".corp.example").
 */
export const ALLOWED_HOSTS: readonly string[] = [
	// "inference.corp.example",
];

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];

export function isHostAllowed(hostname: string, allowedHosts: readonly string[] = ALLOWED_HOSTS): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	return [...LOOPBACK_HOSTS, ...allowedHosts].some((entry) => {
		const allowed = entry.toLowerCase();
		return allowed.startsWith(".") ? host === allowed.slice(1) || host.endsWith(allowed) : host === allowed;
	});
}

function blockedError(hostname: string): Error {
	return new Error(`Blocked outbound connection to ${hostname || "<unknown>"} (not in egress allowlist)`);
}

function requestHostname(input: string | URL | Request): string {
	return new URL(input instanceof Request ? input.url : input.toString()).hostname;
}

const GUARDED = Symbol.for("pi.egressGuarded");

/**
 * Wrap the global fetch and WebSocket so they refuse hosts outside the allowlist.
 * The undici interceptor covers Node; this also covers runtimes whose native fetch
 * ignores undici dispatchers (the Bun-compiled binary). Idempotent.
 */
export function installEgressGuards(allowedHosts: readonly string[] = ALLOWED_HOSTS): void {
	const currentFetch = globalThis.fetch as typeof fetch & { [GUARDED]?: true };
	if (!currentFetch[GUARDED]) {
		const guardedFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			const hostname = requestHostname(input);
			if (!isHostAllowed(hostname, allowedHosts)) return Promise.reject(blockedError(hostname));
			return currentFetch(input, init);
		};
		globalThis.fetch = Object.assign(guardedFetch, currentFetch, { [GUARDED]: true as const });
	}

	const CurrentWebSocket = globalThis.WebSocket as (typeof WebSocket & { [GUARDED]?: true }) | undefined;
	if (CurrentWebSocket && !CurrentWebSocket[GUARDED]) {
		class GuardedWebSocket extends CurrentWebSocket {
			static readonly [GUARDED] = true;
			constructor(url: string | URL, ...rest: unknown[]) {
				const hostname = new URL(url.toString()).hostname;
				if (!isHostAllowed(hostname, allowedHosts)) throw blockedError(hostname);
				super(url, ...(rest as [string | string[] | undefined]));
			}
		}
		globalThis.WebSocket = GuardedWebSocket;
	}
}

/** undici interceptor that rejects requests to hosts outside the allowlist before any connection is made. */
export function egressAllowlistInterceptor(allowedHosts: readonly string[] = ALLOWED_HOSTS) {
	return (dispatch: Dispatcher.Dispatch): Dispatcher.Dispatch =>
		(options, handler) => {
			const hostname = options.origin ? new URL(options.origin.toString()).hostname : "";
			if (!isHostAllowed(hostname, allowedHosts)) throw blockedError(hostname);
			return dispatch(options, handler);
		};
}
