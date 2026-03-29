/**
 * Shared test utilities used across multiple Playwright spec files.
 *
 * These helpers wrap the window.__test interface (exposed in src/index.ts).
 */

export type VisualMove = { move: string; cancel: boolean };


/** Navigate to the app, wait for the test harness, and load an algorithm. */
export async function setup(page: any, alg: string) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), alg);
}

/** Sets up a case by applying the given setup alg to solved state. Must call after setup(). */
export async function setupCaseFromAlg(page: any, setupAlg: string) {
  await page.evaluate((a: string) => (window as any).__test.setupCaseFromAlg(a), setupAlg);
}

/**
 * Simulate a sequence of raw GAN face moves (space-separated).
 * Only single-face moves are accepted (R, L, U, D, F, B and their primes).
 * Slice / wide / rotation moves are NEVER reported by the GAN — decompose
 * them into face moves before calling this helper (e.g. S → "F' B").
 */
export async function doGanMoves(page: any, moves: string) {
  for (const move of moves.trim().split(/\s+/).filter(Boolean)) {
    if (!/^[RLUDFB]'?$/.test(move)) {
      throw new Error(`Invalid GAN move (only R, L, U, D, F, B and their primes): ${move}`);
    }
    await page.evaluate((m: string) => (window as any).__test.simulateMove(m), move);
  }
}

/** Sets test algorithm config (ignore, category, overrideEnabled, algorithm). Must call after setup(). */
export async function setTestAlgConfig(page: any, config: { ignore?: string; category?: string; overrideEnabled?: boolean; algorithm?: string }) {
  await page.evaluate((c: any) => (window as any).__test.setTestAlgConfig(c), config);
}

/** Enables/disables keepRotation for tests. */
export async function setKeepRotation(page: any, enabled: boolean) {
  await page.evaluate((e: boolean) => (window as any).__test.setKeepRotation(e), enabled);
}

/** Loads a new algorithm while preserving physical state and MRM. */
export async function loadNextAlgForTest(page: any, alg: string) {
  await page.evaluate((a: string) => (window as any).__test.loadNextAlgForTest(a), alg);
}

/** Resets masterRepairFaceMap to identity. */
export async function resetRotation(page: any) {
  await page.evaluate(() => (window as any).__test.resetRotation());
}

/** Sets a specific color rotation (e.g. "y", "y'", "y2", ''). */
export async function setColorRotation(page: any, rotation: string) {
  await page.evaluate((r: string) => (window as any).__test.__setColorRotation(r), rotation);
}

/** Sets the color rotation mode (e.g. 'none', 'vertical', 'upside', 'vertical+upside', 'any'). */
export async function setRotateColors(page: any, mode: string) {
  await page.evaluate((m: string) => (window as any).__test.setColorRotationMode(m), mode);
}

/** Sets currentColorRotation and re-draws the algorithm cube display. */
export async function setCurrentColorRotation(page: any, rotation: string) {
  await page.evaluate((r: string) => (window as any).__test.setCurrentColorRotation(r), rotation);
}

/** Re-draws the current algorithm in the cube display. */
export async function redrawAlg(page: any) {
  await page.evaluate(() => (window as any).__test.redraw());
}


/** Retrieve the debug-info snapshot (timerState, currentMoveIndex, …). */
export async function getDebug(page: any) {
  return page.evaluate(() => (window as any).__test.getDebugInfo());
}

/** Retrieve the visual-move log from the page. */
export async function getVisualLog(page: any): Promise<VisualMove[]> {
  return page.evaluate(() => (window as any).__test.getVisualLog());
}

/** Retrieve the visual perfomred moves from the page. */
export async function getVisualMoves(page: any): Promise<string> {
  const log = await page.evaluate(() => (window as any).__test.getVisualLog());
  return extractSeqFromVis(log);
}

/** Clears the visual move log. */
export async function clearVisualLog(page: any) {
  await page.evaluate(() => (window as any).__test.clearVisualLog());
}

export type FlashEvent = { color: string; duration: number };

/** Retrieve the flash event log from the page. */
export async function getFlashLog(page: any): Promise<FlashEvent[]> {
  return page.evaluate(() => (window as any).__test.getFlashLog());
}

/** Clears the flash event log. */
export async function clearFlashLog(page: any) {
  await page.evaluate(() => (window as any).__test.clearFlashLog());
}

/** Inverts a human-readable alg string (e.g. "R U R'" → "R U' R'"). */
export function invertAlgString(alg: string): string {
  return alg.split(/\s+/).reverse().map(m => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith("2")) return m;
    return m + "'";
  }).join(' ');
}

// extracts move string from visual move sequence
export function extractSeqFromVis(s: VisualMove[]): string {
  return s.map(v => v.move).join(' ');
}

// removes double moves, writes them as two single moves (e.g. U2 → U U) and inverts remain (e.g. R' → R')
export function flattenMoveSeq(s: string): string {
  return s.split(/\s+/).map(m => {
    if (m.endsWith("2")) {
      const base = m.slice(0, -1);
      return `${base} ${base}`;
    }
    return m;
  }).join(' ');
}

/**
 * Simulate a sequence of inputs done by the user (from his point of view)).
 * Slice / wide / double rotation moves will be converted 
 * to single-face moves (R, L, U, D, F, B and their primes).
 * and the cube transformations will be remembered and applied
 */
export async function doUserFrameMoves(page: any, moves: string) {
  var transformedganmoves = transformToGan(moves);
  await doGanMoves(page, transformedganmoves);

}
export function transformToGan(moves: string): string {
  var result = "";
  var transforms: string[] = [];
  for (const move of moves.trim().split(/\s+/).filter(Boolean)) {
    const ganmoves = transformToGanMoves(move);
    if (ganmoves !== "") {
      for (const ganmove of ganmoves.trim().split(/\s+/).filter(Boolean)) {
        const transformedganmoves = applyTransformsToGan(ganmove, transforms);
        result += transformedganmoves + " ";
      }
    }
    // remember an undo sequence of transforms
    for (const t of extractTransforms(move)) {
      transforms.unshift(invertMove(t));
    }
  }
  return result.trim();
}

// Inverts a sequence moves
function invertSequence(seq: string): string {
  return seq.trim().split(/\s+/).map(m => {
    return invertMove(m);
  }).join(' ');
}


// returns the invere implied transformation of any move
function invertMove(move: string): string {
  if (move.endsWith("'")) {
    return move.substring(0, move.length - 1);
  }
  else {
    return move + "'";
  }
}

// This function converts user moves (which may include slices, wides, rotations) into the corresponding GAN face moves.
function transformToGanMoves(move: string): string {
  if (move.endsWith("2")) {
    const t = transformToGanMoves(move.substring(0, move.length - 1));
    return t + " " + t;
  }
  if (move.endsWith("'")) {
    const base = transformToGanMoves(move.substring(0, move.length - 1));
    if (base === "") return "";
    return invertSequence(base);
  }
  switch (move) {
    case "d": return "U";
    case "u": return "D";
    case "f": return "B";
    case "b": return "F";
    case "l": return "R";
    case "r": return "L";

    case "M": return "L' R";
    case "E": return "D' U";
    case "S": return "B F'";

    case "x": return "";
    case "y": return "";
    case "z": return "";
    default: return move;
  }
}

// applies a list of transform to a GAN move in given order
function applyTransformsToGan(move: string, transform: string[]): string {
  for (const t of transform) {
    move = applyTranformToGan(move, t);
  }
  return move;
}

// applies a transform to a GAN move
function applyTranformToGan(move: string, transform: string): string {
  if (move.endsWith("'")) {
    return applyTranformToGan(move.substring(0, move.length - 1), transform) + "'";
  }
  switch (transform) {
    case "x":
      switch (move) {
        case "L": return "L";
        case "R": return "R";
        case "U": return "B";
        case "D": return "F";
        case "F": return "U";
        case "B": return "D";
      }
    case "x'":
      switch (move) {
        case "L": return "L";
        case "R": return "R";
        case "U": return "F";
        case "D": return "B";
        case "F": return "D";
        case "B": return "U";
      }
    case "y":
      switch (move) {
        case "L": return "B";
        case "R": return "F";
        case "U": return "U";
        case "D": return "D";
        case "F": return "L";
        case "B": return "R";
      }
    case "y'":
      switch (move) {
        case "L": return "F";
        case "R": return "B";
        case "U": return "U";
        case "D": return "D";
        case "F": return "R";
        case "B": return "L";
      }

    case "z":
      switch (move) {
        case "L": return "U";
        case "R": return "D";
        case "U": return "R";
        case "D": return "L";
        case "F": return "F";
        case "B": return "B";
      }
    case "z'":
      switch (move) {
        case "L": return "D";
        case "R": return "U";
        case "U": return "L";
        case "D": return "R";
        case "F": return "F";
        case "B": return "B";
      }

      // if no LRUFDB of any valid trans will fall through
      throw new Error("invalid move: " + move);

    case "": return move;
    default: throw new Error("invalid tranform: " + transform);
  }
}


function extractTransforms(move: string): string[] {
  if (move.endsWith("2")) {
    const t = extractTransforms(move.substring(0, move.length - 1));
    return [...t, ...t];
  }
  if (move.endsWith("'")) {
    const t = extractTransforms(move.substring(0, move.length - 1));
    if (t.length === 0) return [];
    return [invertMove(t[0])];
  }
  switch (move) {
    case "u": return ["y"];
    case "d": return ["y'"];
    case "f": return ["z"];
    case "b": return ["z'"];
    case "r": return ["x"];
    case "l": return ["x'"];

    case "M": return ["x'"];
    case "E": return ["y'"];
    case "S": return ["z"];

    case "x": return ["x"];
    case "y": return ["y"];
    case "z": return ["z"];
    default: return [];
  }
}