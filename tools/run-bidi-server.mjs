#!/usr/bin/env node

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

import {createWriteStream} from 'fs';

import {createBiDiServerProcess, createLogFile} from './bidi-server.mjs';

const LOG_FILE = createLogFile('server');
const fileWriteStream = createWriteStream(LOG_FILE);
const subprocess = createBiDiServerProcess();

if (subprocess.stderr) {
  subprocess.stderr.pipe(process.stdout);
  subprocess.stderr.pipe(fileWriteStream);
}

if (subprocess.stdout) {
  subprocess.stdout.pipe(process.stdout);
  subprocess.stdout.pipe(fileWriteStream);
}

subprocess.on('error', () => {
  subprocess.kill('SIGKILL');
  process.exit(1);
});

subprocess.on('exit', (status) => {
  process.exit(status || 0);
});
