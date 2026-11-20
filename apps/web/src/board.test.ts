import { describe, expect, it } from "vitest";
import { adjacentStatus, boardSummary, slugify } from "./board";

describe("Kanban presentation rules", () => {
  it("only offers adjacent state transitions", () => {
    expect(adjacentStatus("PLANNED", -1)).toBeNull();
    expect(adjacentStatus("PLANNED", 1)).toBe("IN_PROGRESS");
    expect(adjacentStatus("CODE_REVIEW", -1)).toBe("IN_PROGRESS");
    expect(adjacentStatus("DONE", 1)).toBeNull();
  });

  it("summarizes an empty board", () => {
    expect(boardSummary(null)).toEqual({
      total: 0,
      inProgress: 0,
      done: 0,
      storyPoints: 0,
    });
  });

  it("creates API-safe slugs", () => {
    expect(slugify("Tessera Course Work 2026")).toBe(
      "tessera-course-work-2026",
    );
  });
});
