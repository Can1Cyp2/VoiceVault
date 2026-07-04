/**
 * Tests for app/util/shareRange.ts
 *
 * Covers the shareable-range gate and the share message content.
 */

import {
  isShareableRange,
  buildShareRangeMessage,
  APP_DOWNLOAD_URL,
} from "../../app/util/shareRange";

describe("isShareableRange", () => {
  it("accepts real ranges", () => {
    expect(isShareableRange("F2 - A4")).toBe(true);
    expect(isShareableRange("C#3 - G#5")).toBe(true);
  });

  it("rejects the profile placeholder text and malformed values", () => {
    expect(isShareableRange("Edit your profile to set a vocal range.")).toBe(false);
    expect(isShareableRange(null)).toBe(false);
    expect(isShareableRange("")).toBe(false);
    expect(isShareableRange("F2")).toBe(false);
  });
});

describe("buildShareRangeMessage", () => {
  it("includes the range, voice type, and download link", () => {
    const message = buildShareRangeMessage("F2 - A4", "Baritone");

    expect(message).toContain("F2 - A4");
    expect(message).toContain("(Baritone)");
    expect(message).toContain(APP_DOWNLOAD_URL);
  });

  it("omits the voice type when unknown", () => {
    const message = buildShareRangeMessage("F2 - A4", null);
    expect(message).not.toContain("(");
    expect(message).toContain("F2 - A4");
  });
});
