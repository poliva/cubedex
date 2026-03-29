/**
 * Unit tests for splitAlgAtCursor() in notationHelper.ts.
 * Verifies cursor-based algorithm splitting for all edge cases including
 * within-token, between-token, and boundary positions.
 */
import { test, expect } from '@playwright/test';
import { splitAlgAtCursor } from '../src/notationHelper';

test.describe("splitAlgAtCursor", () => {
  // "S R' |S" (cursor at pos 5, between space and S) -> ["S R'", "S"]
  test("[split-1] cursor between moves", async () => {
    const [left, right] = splitAlgAtCursor("S R' S", 5);
    expect(left).toBe("S R'");
    expect(right).toBe("S");
  });

  // "S R' S|" (cursor at pos 6, at end) -> ["S R' S", ""]
  test("[split-2] cursor at end", async () => {
    const [left, right] = splitAlgAtCursor("S R' S", 6);
    expect(left).toBe("S R' S");
    expect(right).toBe('');
  });

  // "S R|' S" (cursor at pos 3, between R and ') -> ["S R'", "S"]
  test("[split-3] cursor inside multi-char move", async () => {
    const [left, right] = splitAlgAtCursor("S R' S", 3);
    expect(left).toBe("S R'");
    expect(right).toBe("S");
  });

  // "|S R' S" (cursor at pos 0, at start) -> ["", "S R' S"]
  test("[split-4] cursor at start", async () => {
    const [left, right] = splitAlgAtCursor("S R' S", 0);
    expect(left).toBe('');
    expect(right).toBe("S R' S");
  });

  // "S |R' S" (cursor at pos 2, at start of R) -> ["S", "R' S"]
  test("[split-5] cursor at move start", async () => {
    const [left, right] = splitAlgAtCursor("S R' S", 2);
    expect(left).toBe("S");
    expect(right).toBe("R' S");
  });

  // "R U2 F'" with cursor inside U2 -> ["R U2", "F'"]
  test("[split-6] cursor inside double move", async () => {
    const [left, right] = splitAlgAtCursor("R U2 F'", 3);
    expect(left).toBe('R U2');
    expect(right).toBe("F'");
  });

  // "R2' U" with cursor between R and 2 -> ["R2'", "U"]
  test("[split-7] cursor inside R2 prime move", async () => {
    const [left, right] = splitAlgAtCursor("R2' U", 1);
    expect(left).toBe("R2'");
    expect(right).toBe("U");
  });

  // "(R U R' U')" with cursor at pos 6 (between R and ' of R') -> includes R' in left
  test("[split-8] cursor with parentheses", async () => {
    const [left, right] = splitAlgAtCursor("(R U R' U')", 6);
    expect(left).toBe("(R U R'");
    expect(right).toBe("U')");
  });

  // Empty string
  test("[split-9] empty alg", async () => {
    const [left, right] = splitAlgAtCursor('', 0);
    expect(left).toBe('');
    expect(right).toBe('');
  });

  // "L U' L' d' R U2 R'" cursor after d' -> ["L U' L' d'", "R U2 R'"]
  test("[split-10] cursor after wide move", async () => {
    const [left, right] = splitAlgAtCursor("L U' L' d' R U2 R'", 10);
    expect(left).toBe("L U' L' d'");
    expect(right).toBe("R U2 R'");
  });
});
