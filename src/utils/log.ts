/**
 * Copyright 2021 Google LLC.
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

export enum LogType {
  system = 'System',
  bidi = 'BiDi Messages',
  browsingContexts = 'Browsing Contexts',
  cdp = 'CDP',
  commandParser = 'Command parser',
}

export function log(logType: LogType): (...message: unknown[]) => void {
  return (...messages: any[]) => {
    console.log(logType, ...messages);
    // Add messages to the Mapper Tab Page, if exists.
    // Dynamic lookup to avoid circlular dependency.
    if ('MapperTabPage' in globalThis) {
      (
        globalThis as unknown as {
          MapperTabPage: {log: (...message: unknown[]) => void};
        }
      )['MapperTabPage'].log(logType, ...messages);
    }
  };
}
