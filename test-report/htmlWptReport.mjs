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

import fs from 'fs';
import {generateReport} from './htmlWptReportFormatter.mjs';

function readReport(filePath) {
  const rawReport = fs.readFileSync(filePath);
  return JSON.parse(rawReport);
}

function getReportPath() {
  return process.argv.slice(2)[0];
}

function getOutputPath() {
  return process.argv.slice(2)[1];
}

const rawReport = readReport(getReportPath());
const result = generateReport(rawReport);

fs.writeFileSync(getOutputPath(), result);
