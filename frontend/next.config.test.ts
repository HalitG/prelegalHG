import { PHASE_DEVELOPMENT_SERVER, PHASE_EXPORT, PHASE_PRODUCTION_BUILD } from "next/constants";
import { describe, expect, it } from "vitest";
import nextConfig, { DEV_API_ORIGIN } from "./next.config";

describe("next.config", () => {
  it("builds a static export", () => {
    expect(nextConfig(PHASE_PRODUCTION_BUILD).output).toBe("export");
  });

  it("forwards /api to the backend in the dev server", async () => {
    const rewrites = await nextConfig(PHASE_DEVELOPMENT_SERVER).rewrites?.();
    expect(rewrites).toEqual([{ source: "/api/:path*", destination: `${DEV_API_ORIGIN}/api/:path*` }]);
  });

  it.each([PHASE_PRODUCTION_BUILD, PHASE_EXPORT])("has no rewrites in the %s phase", (phase) => {
    expect(nextConfig(phase).rewrites).toBeUndefined();
  });
});
