// Copyright 2026 Lee Jisol <ijisol@naver.com>
// SPDX-License-Identifier: MIT

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

const TRIALS = 63;
const DATASET_SIZE = 4095;
const RANDOM_LAST_INDEX = 4095;
const MAX_STRING_LENGTH = 32;

class Random {
  index = RANDOM_LAST_INDEX;

  constructor(TypedArray) {
    this.buffer = new TypedArray(RANDOM_LAST_INDEX + 1);
  }

  random() {
    const { buffer } = this;
    let { index } = this;
    if (index < RANDOM_LAST_INDEX) {
      ++index;
    } else {
      index = 0;
      crypto.getRandomValues(buffer);
    }
    this.index = index;
    return buffer[index];
  }
}

const uint8 = new Random(Uint8Array);
const int32 = new Random(Int32Array);

const codePointRandoms = (() => {
  // Scenario: EPUB filename uniqueness check
  // https://www.w3.org/TR/epub-33/#sec-container-filenames

  const MIN_CODE_POINT = 0x21;
  const MAX_ASCII_CODE_POINT = 0x7E;
  const MIN_NON_ASCII_CODE_POINT = 0xA0;
  const MAX_CODE_POINT = 0x1FFFD;
  const ASCII_SPAN = MAX_ASCII_CODE_POINT - MIN_CODE_POINT + 1;
  const NON_ASCII_SPAN = MAX_CODE_POINT - MIN_NON_ASCII_CODE_POINT + 1;
  const DISALLOWED_ASCII = [0x22, 0x2A, 0x2E, 0x2F, 0x3A, 0x3C, 0x3E, 0x3F, 0x5C, 0x7C];
  const DISALLOWED_NON_ASCII = [0x149, 0x673, 0xF77, 0xF79];

  const generateCodePoint = (random, isDisallowed) => {
    let codePoint = 0;
    do {
      codePoint = random();
    } while (isDisallowed(codePoint));
    return codePoint;
  };

  const isUpperLatin = (c) => ((c >= 0x41) && (c <= 0x5A));
  const isNotUpperLatin = (c) => !isUpperLatin(c);
  const isDisallowedAscii = (c) => DISALLOWED_ASCII.includes(c);
  const isUpperOrDisallowedAscii = (c) => (isUpperLatin(c) || isDisallowedAscii(c));
  const isDisallowedNonAscii = (c) => (
    (c >= 0x17A3) && ((c <= 0x17A4) ||
    (c >= 0x206A) && ((c <= 0x206F) ||
    (c >= 0x2329) && ((c <= 0x232A) ||
    (c >= 0xD800) && ((c <= 0xF8FF) ||
    (c >= 0xFDD0) && ((c <= 0xFDEF) ||
    (c >= 0xFFFE) && ((c <= 0xFFFF))))))) ||
    DISALLOWED_NON_ASCII.includes(c)
  );

  const randomAscii = () => (uint8.random() % ASCII_SPAN) + MIN_CODE_POINT;
  const randomNonAscii = () => (
    (Math.abs(int32.random()) % NON_ASCII_SPAN) +
    MIN_NON_ASCII_CODE_POINT
  );

  const randomAllowedAscii = () => generateCodePoint(randomAscii, isDisallowedAscii);
  return {
    allowedAscii: randomAllowedAscii,
    allowedLowerAscii: () => generateCodePoint(randomAscii, isUpperOrDisallowedAscii),
    upperLatin: () => generateCodePoint(randomAscii, isNotUpperLatin),
    allowedAny: () => (
      (Math.random() < 0.5) ? randomAllowedAscii() :
      generateCodePoint(randomNonAscii, isDisallowedNonAscii)
    ),
  };
})();

const generateDataset = (codePointRandom) => {
  const dataset = [];
  for (let i = 0; i < DATASET_SIZE; ++i) {
    const chars = [];
    const length = (uint8.random() % MAX_STRING_LENGTH) + 1;
    for (let k = 0; k < length; ++k) {
      chars.push(String.fromCodePoint(codePointRandom()));
    }
    dataset.push(chars.join('').normalize());
  }
  return dataset;
};

const { execPath, stdout } = process;
const workerPath = join(import.meta.dirname, 'worker.js');
const runWorker = (target, input) => {
  const { promise, resolve, reject } = Promise.withResolvers();
  const worker = spawn(execPath, [workerPath, target]);
  const workerStdout = text(worker.stdout);
  const workerStderr = text(worker.stderr);
  worker.on('error', reject);
  worker.on('close', (code) => {
    (code === 0) ?
    workerStdout.then(BigInt).then(resolve).catch(reject) :
    workerStderr.then((error) => {
      if (error) console.error(error);
      reject(new Error(`Worker failed (target=${target}, exitCode=${code})`));
    }).catch(reject);
  });
  worker.stdin.end(input);
  return promise;
};

const maxTrialDigits = `${TRIALS}`.length;
const targets = process.argv.slice(2);
const totalTarget = targets.length;
const durationsByTarget = targets.map(() => new BigUint64Array(TRIALS));

const midIndex = Math.trunc(TRIALS / 2);
const sortAndGetMedianOf = (
  ((TRIALS % 2) !== 0) ?
  (durations) => Number(durations.sort()[midIndex]) :
  (durations) => {
    durations.sort();
    return Math.ceil(Number(durations[midIndex - 1] + durations[midIndex]) / 2);
  }
);

const headings = ['name', 'median', 'min', 'max'];
const lastIndex = TRIALS - 1;
const measureFrom = (median, id) => {
  const { 0: min, [lastIndex]: max } = durationsByTarget[id];
  const name = targets[id];
  const row = [name, `${median} ns`, `${min} ns`, `${max} ns`];
  return { median, name, row };
};

const numbersInAscending = (a, b) => (a - b);
const getMedian = ({ median }) => median;
const getName = ({ name }) => name;
const delimiterFrom = (length) => '-'.repeat(length);

console.log('# Benchmark #');

for (const type in codePointRandoms) {
  const input = JSON.stringify(generateDataset(codePointRandoms[type]));
  console.log(`\n## ${type} (trials=${TRIALS}, dataset=${DATASET_SIZE}) ##\n`);

  for (let index = 0; index < TRIALS; ++index) {
    stdout.write(`\r${`${index + 1}`.padStart(maxTrialDigits)}/${TRIALS}...`);
    for (let id = 0; id < totalTarget; ++id) {
      durationsByTarget[id][index] = await runWorker(targets[id], input);
    }
  }

  const medians = durationsByTarget.map(sortAndGetMedianOf);
  const measures = medians.map(measureFrom);
  const colLength = headings.map((heading, col) => {
    const getCellLength = ({ row }) => row[col].length;
    return Math.max(heading.length, ...measures.values().map(getCellLength));
  });

  const padCell = (cell, col) => cell.padStart(colLength[col]);
  const padRow = ({ row }) => row.map(padCell).join(' | ');
  const rows = measures.map(padRow);

  medians.sort(numbersInAscending);
  const groupByMedian = Object.groupBy(measures, getMedian);
  const groups = medians.map((e) => groupByMedian[e].map(getName).join(', '));
  const winners = groups.shift();
  const fastest = medians.shift();

  stdout.write('\r\x1B[2K');
  console.log(`\
| ${headings.map(padCell).join(' | ')} |
| ${colLength.map(delimiterFrom).join(' | ')} |
| ${rows.join(` |
| `)} |

${winners}:${groups.map((e, i) => `
- ${(medians[i] / fastest).toPrecision(3)}x faster than ${e}`).join('')}`);
}
