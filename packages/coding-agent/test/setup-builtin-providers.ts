import { vi } from "vitest";

// Production builds disable built-in third-party providers (see src/core/enabled-builtin-providers.ts).
// Tests exercise them with stubbed network, so enable all of them here.
vi.mock("../src/core/enabled-builtin-providers.ts", () => ({ isBuiltinProviderEnabled: () => true }));
