#!/usr/bin/env node

/**
 * Copyright 2024 Google LLC.
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

import {spawn} from 'child_process';
import {writeFile} from 'fs/promises';

import {packageDirectorySync} from 'pkg-dir';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('ts-file', {
    describe: 'A .ts file to write generated types to',
    type: 'string',
    default: 'src/protocol/generated/webdriver-bidi.ts',
    demandOption: true,
  })
  .option('zod-file', {
    describe: 'A .ts file to write generated Zod types to',
    type: 'string',
    default: 'src/protocol-parser/generated/webdriver-bidi.ts',
    demandOption: true,
  })
  .option('cddl-file', {
    describe: 'A .cddl file containing the type description',
    type: 'string',
    demandOption: true,
  })
  .exitProcess(true)
  .parse();

// Changing the current work directory to the package directory.
const ROOT_DIR = packageDirectorySync();
process.chdir(ROOT_DIR);

const TYPES_FILE = argv.tsFile;
const ZOD_FILE = argv.zodFile;
const FILE_HEADER = `
/**
 * Copyright 2024 Google LLC.
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
 * THIS FILE IS AUTOGENERATED. Run \`npm run bidi-types\` to regenerate.
 * @see https://github.com/w3c/webdriver-bidi/blob/master/index.bs
 */

`;

async function runCommand(command, args) {
  const cwd = packageDirectorySync();
  return await new Promise((resolve, reject) => {
    let output = '';
    const commandProcess = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      env: process.env,
      cwd,
    });

    commandProcess.stdout.on('data', (data) => {
      output += data;
    });

    commandProcess.on('error', (message) => {
      reject(message);
    });

    commandProcess.on('exit', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command ${command} ${args.join(' ')} failed!`));
      }
    });
  });
}

async function runCddlConv(file, options) {
  const cddlConv = await runCommand('cddlconv', options);
  let output = `${FILE_HEADER}${cddlConv}`;
  await writeFile(file, output, 'utf8');
}

async function generateTypes() {
  await runCddlConv(TYPES_FILE, [argv.cddlFile]);
}

async function generateZod() {
  await runCddlConv(ZOD_FILE, ['--format', 'zod', argv.cddlFile]);
}

await Promise.all([generateTypes(), generateZod()]);
