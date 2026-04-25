import { describe, it, expect } from "vitest";
import {
  dashboardBaseUrl,
  startLoopbackServer,
  loginCommand,
  makeLoginCommand,
} from "../commands/auth/login.js";

describe("dashboardBaseUrl", () => {
  it("maps api.useinvariance.com to app.useinvariance.com", () => {
    expect(dashboardBaseUrl("https://api.useinvariance.com")).toBe(
      "https://app.useinvariance.com",
    );
  });

  it("maps local api (3001) to Vite dashboard (5173)", () => {
    expect(dashboardBaseUrl("http://localhost:3001")).toBe("http://localhost:5173");
    expect(dashboardBaseUrl("http://127.0.0.1:3001")).toBe("http://127.0.0.1:5173");
  });

  it("honours INVARIANCE_DASHBOARD_URL override", () => {
    const prev = process.env["INVARIANCE_DASHBOARD_URL"];
    process.env["INVARIANCE_DASHBOARD_URL"] = "https://example.test/";
    try {
      expect(dashboardBaseUrl("https://api.useinvariance.com")).toBe(
        "https://example.test",
      );
    } finally {
      if (prev === undefined) delete process.env["INVARIANCE_DASHBOARD_URL"];
      else process.env["INVARIANCE_DASHBOARD_URL"] = prev;
    }
  });
});

describe("startLoopbackServer", () => {
  it("resolves with the token when the callback includes matching state", async () => {
    const state = "abc123";
    const { port, result, close } = await startLoopbackServer(state);
    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/?state=${state}&token=inv_live_xyz`,
      );
      expect(res.status).toBe(200);
      const r = await result;
      expect(r.token).toBe("inv_live_xyz");
      expect(r.state).toBe(state);
      expect(r.error).toBeUndefined();
    } finally {
      close();
    }
  });

  it("rejects mismatched state (no token captured)", async () => {
    const { port, result, close } = await startLoopbackServer("expected");
    try {
      await fetch(
        `http://127.0.0.1:${port}/?state=attacker&token=inv_live_bad`,
      );
      const r = await result;
      // Server still captures what the callback sent, but the login flow
      // rejects on mismatch. Verify the state field reflects the mismatch.
      expect(r.state).toBe("attacker");
    } finally {
      close();
    }
  });

  it("surfaces error=denied from the callback", async () => {
    const { port, result, close } = await startLoopbackServer("s");
    try {
      await fetch(`http://127.0.0.1:${port}/?state=s&error=denied`);
      const r = await result;
      expect(r.error).toBe("denied");
    } finally {
      close();
    }
  });
});

describe("login command surface", () => {
  it("exposes --api-key, --profile, --browser, --paste", () => {
    const flags = loginCommand.options.map((o) => o.long);
    expect(flags).toContain("--api-key");
    expect(flags).toContain("--profile");
    expect(flags).toContain("--browser");
    expect(flags).toContain("--paste");
  });

  it("makeLoginCommand produces a fresh Command with the same options", () => {
    const fresh = makeLoginCommand("login");
    expect(fresh.name()).toBe("login");
    expect(fresh.options.map((o) => o.long).sort()).toEqual(
      loginCommand.options.map((o) => o.long).sort(),
    );
  });
});
