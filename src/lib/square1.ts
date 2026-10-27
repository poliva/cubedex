import { Alg } from 'cubing/alg';

/** Accept both (a, b) and compact a,b notation without changing signed turns. */
export function normalizeSquare1Notation(input: string): string {
  return input.replace(/\u2212/g, '-')
    .replace(/\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?/g, '($1, $2)')
    .replace(/\//g, ' / ').replace(/\s+/g, ' ').trim();
}

/** Rebuild native turn pairs after cubing expands or inverts them into layer moves. */
export function square1Tokens(alg: Alg): string[] {
  const tokens: string[] = [];
  let top: number | null = null;
  let bottom: number | null = null;
  const flush = () => {
    if (top !== null || bottom !== null) tokens.push(`(${top ?? 0}, ${bottom ?? 0})`);
    top = bottom = null;
  };
  for (const move of alg.experimentalLeafMoves()) {
    if (move.family === 'U_SQ_') {
      if (top !== null) flush();
      top = move.amount;
    } else if (move.family === 'D_SQ_') {
      if (bottom !== null) flush();
      bottom = move.amount;
    } else {
      flush();
      tokens.push(move.family === '_SLASH_' ? '/' : move.toString());
    }
  }
  flush();
  return tokens;
}

export function square1LeafCount(token: string): number {
  return [...new Alg(token).experimentalLeafMoves()].length;
}

/** Tokenize without splitting the two numbers of a Square-1 turn pair. */
export function algorithmDisplayTokens(algorithm: string): string[] {
  return algorithm.match(/\([^()]*,[^()]*\)|[^\s]+/g) ?? [];
}
