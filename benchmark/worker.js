// Copyright 2026 Lee Jisol <ijisol@naver.com>
// SPDX-License-Identifier: MIT

import { json } from 'node:stream/consumers';
import caseFolding from '../mappings.js';

const variants = {
  A: function toCasefold(char) {
    const codePoint = char.codePointAt();
    return (
      (codePoint <= 0x5A) ? ((codePoint >= 0x41) ?
      String.fromCharCode(codePoint + 0x20) : char) :
      (codePoint < 0xB5) ? char : (this[codePoint] ?? char)
    );
  },
  B: function toCasefold(char) {
    const codePoint = char.codePointAt();
    return (
      (codePoint >= 0xB5) ? (this[codePoint] ?? char) :
      ((codePoint <= 0x5A) && (codePoint >= 0x41)) ?
      String.fromCharCode(codePoint + 0x20) : char
    );
  },
  C: function toCasefold(char) {
    const codePoint = char.codePointAt();
    return (codePoint < 0xB5) ? char.toLowerCase() : (this[codePoint] ?? char);
  },
};

const { hrtime } = process;
const dataset = await json(process.stdin);
const toCasefold = variants[process.argv[2]];

const start = hrtime.bigint();
for (let i = dataset.length - 1; i >= 0; --i) {
  Array.from(dataset[i], toCasefold, caseFolding);
}
const end = hrtime.bigint();

process.stdout.write((end - start).toString());
