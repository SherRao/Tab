import { describe, expect, it } from "vitest";
import { computeTargetSize } from "../image-preprocess";

describe("computeTargetSize", () => {
  it("keeps sizes under the max edge unchanged", () => {
    expect(computeTargetSize(1200, 900)).toEqual({ width: 1200, height: 900 });
  });

  it("downscales landscape photos proportionally", () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it("downscales portrait photos proportionally", () => {
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("handles degenerate input", () => {
    expect(computeTargetSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
