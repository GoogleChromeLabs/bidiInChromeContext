#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Copyright 2023 Google LLC.
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Installs a browser defined in `.browser` or corresponding
 * ChromeDriver using `@puppeteer/browsers` to the directory provided as the
 * first argument (default: $HOME/.cache/chromium-bidi).
 *
 * If `--chrome-driver` is set, the ChromeDriver is installed instead of a
 * browser.
 *
 * If `--github` is set, the executable path is written to the
 * `executablePath` output param for GitHub actions. Otherwise, the executable
 * is written to stdout.
 *
 * Examples:
 *  - `node tools/install-browser.mjs`
 *  - `node tools/install-browser.mjs /tmp/cache`
 *  - `node tools/install-browser.mjs --chrome-driver`
 */

import {readFile} from 'fs/promises';
import {homedir} from 'os';
import {resolve} from 'path';

import {setOutput, setFailed} from '@actions/core';
import {install, computeExecutablePath} from '@puppeteer/browsers';

const GITHUB_SHELL_ARG = '--github';
const CHROME_DRIVER_ARG = '--chrome-driver';

try {
  const browserSpec = (await readFile('.browser', 'utf-8')).trim();

  let cacheDir = resolve(homedir(), '.cache', 'chromium-bidi');
  if (
    process.argv[2] &&
    process.argv[2] !== GITHUB_SHELL_ARG &&
    process.argv[2] !== CHROME_DRIVER_ARG
  ) {
    cacheDir = process.argv[2];
  }

  // See .browser for the format.
  // Contains either a browser name or `chromedriver`.
  const product = process.argv.includes(CHROME_DRIVER_ARG)
    ? 'chromedriver'
    : browserSpec.split('@')[0];
  const buildId = browserSpec.split('@')[1];

  await install({
    browser: product,
    buildId,
    cacheDir,
  });

  const executablePath = computeExecutablePath({
    cacheDir,
    browser: product,
    buildId,
  });
  if (process.argv.includes(GITHUB_SHELL_ARG)) {
    setOutput('executablePath', executablePath);
  } else {
    console.log(executablePath);
  }
} catch (err) {
  setFailed(`Failed to download the browser: ${err.message}`);
}
