import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  createWorkspaceSchema,
  moveTaskCommandSchema,
  taskSchema,
} from "./schemas.js";

describe("shared contracts", () => {
  it("accepts a valid PAY task", () => {
    expect(
      taskSchema.parse({
        taskId: "task-42",
        taskKey: "PAY-42",
        workspaceId: "ws-901",
        title: "Реалізація WebSocket-хабу синхронізації",
        status: "IN_PROGRESS",
        priority: "HIGH",
        storyPoints: 5,
        version: 1,
      }),
    ).toBeDefined();
  });

  it("rejects a move without optimistic-lock version", () => {
    expect(() =>
      moveTaskCommandSchema.parse({
        taskId: "task-42",
        targetColumnId: "col-03",
      }),
    ).toThrow();
  });

  it("normalizes a project code for stable task keys", () => {
    expect(
      createProjectSchema.parse({
        code: "tes",
        name: "Tessera",
      }),
    ).toEqual({
      code: "TES",
      name: "Tessera",
      description: "",
    });
  });

  it("rejects an unsafe workspace slug", () => {
    expect(() =>
      createWorkspaceSchema.parse({
        slug: "Tessera Workspace",
        name: "Tessera",
      }),
    ).toThrow();
  });
});
