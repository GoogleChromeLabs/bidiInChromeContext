/*
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
import type {CdpTarget} from '../context/CdpTarget.js';

import type {PreloadScript} from './PreloadScript.js';

/** BidiPreloadScripts can be filtered by BiDi ID or target ID. */
export type BidiPreloadScriptFilter = Partial<
  Pick<PreloadScript, 'id'> & Pick<CdpTarget, 'targetId'>
>;

/**
 * Container class for preload scripts.
 */
export class PreloadScriptStorage {
  /** Tracks all BiDi preload scripts.  */
  readonly #scripts = new Set<PreloadScript>();

  /** Finds all entries that match the given filter. */
  find(filter?: BidiPreloadScriptFilter): PreloadScript[] {
    if (!filter) {
      return [...this.#scripts];
    }

    return [...this.#scripts].filter((script) => {
      if (filter.id !== undefined && filter.id !== script.id) {
        return false;
      }
      if (
        filter.targetId !== undefined &&
        !script.targetIds.has(filter.targetId)
      ) {
        return false;
      }
      return true;
    });
  }

  add(preloadScript: PreloadScript) {
    this.#scripts.add(preloadScript);
  }

  /** Deletes all BiDi preload script entries that match the given filter. */
  removeAll(filter?: BidiPreloadScriptFilter) {
    for (const preloadScript of this.find(filter)) {
      this.#scripts.delete(preloadScript);
    }
  }
}
