/**
 * Copyright 2022 Google LLC.
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
import {Message} from '../../../protocol/protocol.js';
import {BrowsingContextImpl} from './browsingContextImpl.js';

export class BrowsingContextStorage {
  #contexts = new Map<string, BrowsingContextImpl>();

  public getTopLevelContexts(): BrowsingContextImpl[] {
    return Array.from(this.#contexts.values()).filter(
      (c) => c.parentId === null
    );
  }

  public removeContext(contextId: string) {
    this.#contexts.delete(contextId);
  }

  public addContext(context: BrowsingContextImpl) {
    this.#contexts.set(context.contextId, context);
    if (context.parentId !== null) {
      this.getKnownContext(context.parentId).addChild(context);
    }
  }

  public hasKnownContext(contextId: string): boolean {
    return this.#contexts.has(contextId);
  }

  public findContext(contextId: string): BrowsingContextImpl | undefined {
    return this.#contexts.get(contextId);
  }

  public getKnownContext(contextId: string): BrowsingContextImpl {
    const result = this.findContext(contextId);
    if (result === undefined) {
      throw new Message.NoSuchFrameException(`Context ${contextId} not found`);
    }
    return result;
  }
}
