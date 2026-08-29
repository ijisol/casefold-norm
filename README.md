# casefold-norm

Implements the [Unicode canonical case fold normalization step](https://www.w3.org/TR/charmod-norm/#CanonicalFoldNormalizationStep) for JavaScript.

## Install

Install from the [npm registry](https://www.npmjs.com/package/casefold-norm):

``` shell
npm i casefold-norm
```

Or, download [casefold-norm.js](https://github.com/ijisol/casefold-norm/blob/latest/casefold-norm.js) and [mappings.js](https://github.com/ijisol/casefold-norm/blob/latest/mappings.js) directly.

## Usage

``` javascript
import { canonicalCasefoldNormalize } from 'casefold-norm';
import caseFolding from 'casefold-norm/mappings';

const seen = new Set().add(canonicalCasefoldNormalize('όσος', caseFolding));
seen.has(canonicalCasefoldNormalize('ΌΣΟΣ', caseFolding)); // true
```

Details are in the [JSDoc comments](casefold-norm.js).

To generate the mappings for `canonicalCasefoldNormalize()` from the latest Unicode version, run the bundled CLI: [`npx casefold-norm`](build.js). The output path defaults to './mappings.js'; it can be specified with `-o` or `--output`.

## Copyright

Copyright (c) 2026 Lee Jisol \<ijisol@naver.com>

Licensed under the [MIT License](LICENSE).
