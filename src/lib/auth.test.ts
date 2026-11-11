import { afterEach, describe, expect, it } from "vitest";
import { roleForCode, sessionToken } from "./auth";

describe("codes", () => {
  afterEach(() => {
    delete process.env.RCW_ACCESS_CODE;
    delete process.env.RCW_GUEST_CODE;
  });

  it("tells Russell's code from the guest code", () => {
    process.env.RCW_ACCESS_CODE = "12345678";
    process.env.RCW_GUEST_CODE = "87654321";
    expect(roleForCode("1234 5678")).toBe("russell");
    expect(roleForCode("87654321")).toBe("guest");
    expect(roleForCode("00000001")).toBeNull();
    expect(sessionToken("guest")).not.toBe(sessionToken("russell"));
  });

  it("Russell wins if both codes are the same", () => {
    process.env.RCW_ACCESS_CODE = "12345678";
    process.env.RCW_GUEST_CODE = "12345678";
    expect(roleForCode("12345678")).toBe("russell");
  });
});
