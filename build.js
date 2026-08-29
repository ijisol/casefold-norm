#!/usr/bin/env node

// Copyright (c) 2026 Lee Jisol <ijisol@naver.com>
// SPDX-License-Identifier: MIT

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const DEFAULT_OUTPUT = './mappings.js';
const UNICODE_URL = 'https://www.unicode.org';

const args = parseArgs({
  options: {
    help: { type: 'boolean', default: false },
    output: { type: 'string', default: DEFAULT_OUTPUT, short: 'o' },
  },
}).values;

if (args.help) {
  console.log(`\
Usage: npx casefold-norm [-o|--output <path>]

-o|--output <path>  To output the generated mappings (default: ${DEFAULT_OUTPUT})`);
} else {
  const output = resolve(args.output);
  const version = await getLatestVersion();
  console.log(`Latest version: ${version}`);
  const [ data, bidiRange ] = await Promise.all([
    getData(version, '/ucd/CaseFolding.txt'),
    getData(version, '/ucd/extracted/DerivedBidiClass.txt').then(bidiRangeFrom),
  ]);
  const chunks = [];
  const eof = data.length;
  const leadingZeros = /^0+/;
  const literalFrom = (hex) => {
    const char = String.fromCodePoint(Number.parseInt(hex, 16));
    return bidiRange.test(char) ? unicodeLiteralFrom(hex) : char;
  };
  // https://www.unicode.org/reports/tr44/#Format_Conventions
  for (let i = 0, k = 0, ascii = true; i < eof; i = k + 1) {
    k = data.indexOf('\n', i);
    if (k === i) continue;
    if (k === -1) k = eof;
    if (data.startsWith('#', i)) continue;
    const fields = data.slice(i, k).split('; ', 3);
    const state = fields[1];
    const common = (state === 'C');
    if (!common && (state !== 'F')) continue;
    const hex = fields[0]; 
    ascii &&= (Number.parseInt(hex, 16) <= 0x7F);
    if (ascii) continue;
    const mapping = fields[2];
    chunks.push(`0x${hex.replace(leadingZeros, '')}:'${
      common ? literalFrom(mapping) :
      mapping.split(' ').map(literalFrom).join('')
    }'`);
  }
  const code = `\
/**
 * Unicode ${version} full case folding mappings except the ACII range
 * @type {{ [codePoint: number]: string }}
 */
export default {
${chunks.join(',')}
};
`;
  await writeFile(output, code);
  console.log(`${output} - ${Buffer.byteLength(code)} bytes`);
}

async function request(url, init) {
  const res = await fetch(url, init);
  if (res.ok) return res;
  const headers = Array.from(res.headers, (e) => e.join(': ')).join('\n');
  throw new Error(`"${res.url}" ${res.status}\n${headers}`);
}

async function getLatestVersion() {
  // https://www.unicode.org/versions/#TUS_Latest_Version
  try {
    const { url } = await request(UNICODE_URL + '/versions/latest/', { method: 'HEAD' });
    const end = url.length - 1;
    const start = url.lastIndexOf('e', end - '00.0.0'.length - 1) + 1;
    const version = url.slice(start, end);
    if (/^\d+\.\d+\.\d+$/.test(version)) return version;
    throw new Error('Cannot parse the version');
  } catch (cause) {
    throw new Error('Failed to get the latest version', { cause });
  }
}

async function getData(version, path) {
  try {
    const res = await request(UNICODE_URL + '/Public/' + version + path);
    return await res.text();
  } catch (cause) {
    throw new Error('Failed to get the data file', { cause });
  }
}

function bidiRangeFrom(data) {
  // https://www.unicode.org/reports/tr44/#Missing_Conventions
  const chunks = [];
  const behind = '\n# ';
  const search = '@missing: ';
  const searchOffset = behind.length;
  const startOffset = search.length;
  const minLineEndOffset = startOffset + '0000..0000; A'.length;
  const startToLineEnd = /^([0-9A-F]{4,6})\.\.([0-9A-F]{4,6}); (.+)$/;
  let end = '';
  for (
    let i = data.indexOf(search, searchOffset), k = 0;
    i !== -1;
    i = data.indexOf(search, k + searchOffset)
  ) {
    k = data.indexOf('\n', i + minLineEndOffset);
    if (k === -1) k = data.length;
    if (!data.endsWith(behind, i)) continue;
    const result = startToLineEnd.exec(data.slice(i + startOffset, k));
    if (result === null) continue;
    const script = result[3];
    if ((script !== 'Right_To_Left') && (script !== 'Arabic_Letter')) continue;
    const start = result[1];
    if (Number.parseInt(start, 16) !== (Number.parseInt(end, 16) + 1)) {
      chunks.push(unicodeLiteralFrom(end), unicodeLiteralFrom(start), '-');
    }
    end = result[2];
  }
  chunks[0] = '[';
  chunks.push(unicodeLiteralFrom(end), ']');
  return new RegExp(chunks.join(''), 'u');
}

function unicodeLiteralFrom(hex) {
  return (hex.length > 4) ? `\\u{${hex}}` : `\\u${hex}`;
}
