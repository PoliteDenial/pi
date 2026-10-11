import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Agent, fetch, WebSocket } from "undici";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { egressAllowlistInterceptor, installEgressGuards, isHostAllowed } from "../src/core/egress-allowlist.ts";

describe("isHostAllowed", () => {
	it("allows loopback and listed hosts only", () => {
		expect(isHostAllowed("localhost", [])).toBe(true);
		expect(isHostAllowed("127.0.0.1", [])).toBe(true);
		expect(isHostAllowed("[::1]", [])).toBe(true);
		expect(isHostAllowed("inference.corp.example", ["inference.corp.example"])).toBe(true);
		expect(isHostAllowed("api.openai.com", ["inference.corp.example"])).toBe(false);
		expect(isHostAllowed("pi.dev", [])).toBe(false);
	});

	it("matches subdomains for dot-prefixed entries without suffix confusion", () => {
		expect(isHostAllowed("a.corp.example", [".corp.example"])).toBe(true);
		expect(isHostAllowed("corp.example", [".corp.example"])).toBe(true);
		expect(isHostAllowed("evilcorp.example", [".corp.example"])).toBe(false);
	});
});

describe("egressAllowlistInterceptor", () => {
	let server: Server;
	let port: number;
	const dispatcher = new Agent().compose(egressAllowlistInterceptor([]));

	beforeAll(async () => {
		server = createServer((_req, res) => res.end("ok"));
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		port = (server.address() as AddressInfo).port;
	});
	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	it("lets loopback requests through", async () => {
		const response = await fetch(`http://127.0.0.1:${port}/`, { dispatcher });
		expect(await response.text()).toBe("ok");
	});

	it("rejects fetch to a host outside the allowlist", async () => {
		await expect(fetch("https://pi.dev/api/latest-version", { dispatcher })).rejects.toThrow();
		const error = await fetch("https://pi.dev/", { dispatcher }).catch((e: Error) => e);
		expect(String((error as Error).cause ?? error)).toContain("not in egress allowlist");
	});

	it("rejects WebSocket to a host outside the allowlist", async () => {
		const socket = new WebSocket("wss://pi.dev/relay", { dispatcher });
		const outcome = await new Promise<string>((resolve) => {
			socket.addEventListener("open", () => resolve("open"));
			socket.addEventListener("error", () => resolve("error"));
		});
		expect(outcome).toBe("error");
	});
});

describe("installEgressGuards", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("guards the global fetch even when the runtime fetch ignores undici dispatchers", async () => {
		const innerFetch = vi.fn(async () => new Response("ok"));
		vi.stubGlobal("fetch", innerFetch);
		installEgressGuards(["inference.corp.example"]);
		installEgressGuards(["inference.corp.example"]);

		await expect(globalThis.fetch("https://api.openai.com/v1/chat/completions")).rejects.toThrow(
			"not in egress allowlist",
		);
		await expect(globalThis.fetch(new Request("https://pi.dev/api/latest-version"))).rejects.toThrow(
			"not in egress allowlist",
		);
		expect(innerFetch).not.toHaveBeenCalled();

		await globalThis.fetch("https://inference.corp.example/v1/models");
		expect(innerFetch).toHaveBeenCalledTimes(1);
	});

	it("guards the global WebSocket constructor", () => {
		class FakeWebSocket {
			readonly url: string;
			constructor(url: string | URL) {
				this.url = url.toString();
			}
		}
		vi.stubGlobal("WebSocket", FakeWebSocket);
		installEgressGuards([]);

		expect(() => new globalThis.WebSocket("wss://chatgpt.com/backend-api/codex")).toThrow("not in egress allowlist");
		expect(new globalThis.WebSocket("ws://127.0.0.1:1234/").url).toBe("ws://127.0.0.1:1234/");
	});
});
