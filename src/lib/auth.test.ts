import { afterEach, describe, expect, it } from "vitest";
import { roleForCode, sessionToken } from "./auth";

describe("codes", () => {
  afterEach(() => {
    delete process.env.RCW_ACCESS_CODE;
  });

  it("only Russell's code opens a role; guests use the button", () => {
    process.env.RCW_ACCESS_CODE = "12345678";
    expect(roleForCode("1234 5678")).toBe("russell");
    expect(roleForCode("00000001")).toBeNull();
    expect(sessionToken("guest")).not.toBe(sessionToken("russell"));
  });
});
