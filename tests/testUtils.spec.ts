/**
 * Tests for testUtils.ts helper functions.
 * Verifies that transformToGan and other test utilities correctly translate
 * user-frame algorithm moves to the raw GAN face-move sequences.
 */
import { test, expect } from '@playwright/test';
import { transformToGan } from './testUtils';

test("[test-util-1] convert to gan sequence simple", async () => {
    const seq = "R L U' R L U";
    const transformed = transformToGan(seq);
    expect(transformed).toBe(seq);
});

test("[test-util-2] convert to gan sequence with x", async () => {
    const seq = "x R U R' U'";
    const transformed = transformToGan(seq);
    expect(transformed).toBe("R F R' F'");
});

test("[test-util-3] convert to gan sequence with f", async () => {
    const seq = "f R U R' U' f' R U R' U'";
    const transformed = transformToGan(seq);
    expect(transformed).toBe("B U L U' L' B' R U R' U'");
});

test("[test-util-4] convert to gan sequence with U2'", async () => {
    const seq = "f R U2 R' U2' f' R U2 R' U'2";
    const transformed = transformToGan(seq);
    expect(transformed).toBe("B U L L U' L' L' B' R U U R' U' U'");
});

test("[test-util-5] convert to gan sequence with S'", async () => {
    const seq = "S R S'";
    const transformed = transformToGan(seq);
    expect(transformed).toBe("B F' U B' F");
});

test("[test-util-6] cascaded wide moves", async () => {
    const seq = "f u R'";
    const transformed = transformToGan(seq);
    expect(transformed).toBe("B R B'");
});

test("[test-util-7] convert to gan sequence with M'", async () => {
    const seq = "M U R";
    const transformed = transformToGan(seq);
    expect(transformed).toBe("L' R B R");
});

test("[test-util-7] convert to gan sequence with M2'", async () => {
    const seq = "M2 U F' M2 u2";
    const transformed = transformToGan(seq);
    expect(transformed).toBe("L' R L' R D B' L' R L' R D D");
});
