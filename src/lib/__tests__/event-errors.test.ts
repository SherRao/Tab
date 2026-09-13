import { describe, expect, it } from "vitest";
import { DELETE_ERROR_ONLY_OWNER, EVENT_ERRORS, resolveEventError } from "@/lib/event-errors";

describe("resolveEventError", () => {
  it("renders known add/claim messages and maps delete codes", () => {
    expect(resolveEventError(EVENT_ERRORS.accountAlreadyInEvent)).toBe(
      EVENT_ERRORS.accountAlreadyInEvent,
    );
    expect(resolveEventError(undefined, EVENT_ERRORS.cannotClaim)).toBe(
      EVENT_ERRORS.cannotClaim,
    );
    expect(resolveEventError(undefined, undefined, DELETE_ERROR_ONLY_OWNER)).toBe(
      "Only the event owner can delete this event",
    );
  });

  it("ignores unknown query values", () => {
    expect(resolveEventError("Your tab is locked, call 1-800")).toBeUndefined();
    expect(resolveEventError(undefined, "pay now")).toBeUndefined();
    expect(resolveEventError(undefined, undefined, "nope")).toBeUndefined();
  });
});
