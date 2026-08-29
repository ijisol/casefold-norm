// Copyright (c) 2026 Lee Jisol <ijisol@naver.com>
// SPDX-License-Identifier: MIT

function toCasefold(char) {
  const codePoint = char.codePointAt();
  return (
    // U+00B5 is the lowest code point with a case folding mapping after Z
    (codePoint >= 0xB5) ? (this[codePoint] ?? char) :
    ((codePoint <= 0x5A) && (codePoint >= 0x41)) ? // A-Z
    String.fromCharCode(codePoint + 0x20) : char
  );
}

/**
 * Implements the [Unicode canonical case fold normalization
 * step](https://www.w3.org/TR/charmod-norm/#CanonicalFoldNormalizationStep).
 *
 * Does not perform the post-case fold normalization. Call `normalize()` on
 * the result if needed.
 *
 * @param {string} string To normalize
 * @param {{ [codePoint: number]: string }} caseFolding Full case folding mappings
 * @returns {string}
 */
export function canonicalCasefoldNormalize(string, caseFolding) {
  return Array.from(string.normalize(), toCasefold, caseFolding).join('');
}
