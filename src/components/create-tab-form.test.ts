import { describe, expect, it } from "vitest";
import { canContinueToPeople } from "./create-tab-form";

describe("canContinueToPeople", () => {
  it("requires a nonblank tab name", () => {
    expect(canContinueToPeople("  ")).toBe(false);
    expect(canContinueToPeople("Cabin weekend")).toBe(true);
  });
});
