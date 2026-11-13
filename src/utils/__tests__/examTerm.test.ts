import { describe, expect, it } from "vitest";
import { resultTermLabel } from "@/utils/examTerm";

describe("resultTermLabel", () => {
  it("uses semester labels for public school result titles", () => {
    expect(resultTermLabel("Annual-I")).toBe("1st Semester");
    expect(resultTermLabel("Annual-II")).toBe("2nd Semester");
  });

  it("preserves unknown exam labels", () => {
    expect(resultTermLabel("Mid-Term")).toBe("Mid-Term");
  });
});
