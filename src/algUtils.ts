// Split double slice/rotation moves into two single moves for pattern matching.
// M2->[M,M], S2'->[S',S'], x2->[x,x], etc. This lets the GAN cube's
// two-event-per-slice-move behavior match intermediate pattern states.
export function expandSliceDoubles(moves: string[]): string[] {
  const result: string[] = [];
  for (const move of moves) {
    const bare = move.replace(/[()]/g, '');
    const base = bare.replace(/[2']/g, '');
    const isSliceOrRotation = /^[MESxyz]$/.test(base);
    const isDouble = bare.includes('2');
    if (isSliceOrRotation && isDouble) {
      const isPrime = bare.includes("'");
      const singleMove = isPrime ? base + "'" : base;
      result.push(singleMove, singleMove);
    } else {
      result.push(move);
    }
  }
  return result;
}
