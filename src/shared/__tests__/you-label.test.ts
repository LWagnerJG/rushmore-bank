import { describe, expect, it } from "vitest";
import {
  isYouName,
  nameWithYouSuffix,
  railChipTip,
  railYouLabel,
  youInlineSuffix,
} from "@/shared/you-label";

describe("you-label", () => {
  it("detects you-names case-insensitively", () => {
    expect(isYouName("you")).toBe(true);
    expect(isYouName("You")).toBe(true);
    expect(isYouName(" YOU ")).toBe(true);
    expect(isYouName("Wags")).toBe(false);
  });

  it("rail chip shows a single You, never You · you", () => {
    expect(railYouLabel()).toBe("You");
    expect(railChipTip("you", { you: true, up: false })).toBe("You");
    expect(railChipTip("You", { you: true, up: true })).toBe(
      "You · on the clock",
    );
    expect(railChipTip("Wags", { you: true, up: false })).toBe("Wags");
    expect(railChipTip("Wags", { you: true, up: true })).toBe(
      "Wags · on the clock",
    );
    expect(railChipTip("Ada", { you: false, up: true })).toBe(
      "Ada · on the clock",
    );
  });

  it("inline · you suffix skips when the name is already you", () => {
    expect(youInlineSuffix("You")).toBe("");
    expect(youInlineSuffix("you")).toBe("");
    expect(youInlineSuffix("Wags")).toBe(" · you");
  });

  it("name (you) collapses when the nickname is you", () => {
    expect(nameWithYouSuffix("You")).toBe("You");
    expect(nameWithYouSuffix("you")).toBe("You");
    expect(nameWithYouSuffix("Ada")).toBe("Ada (you)");
  });
});
