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
 *
 */

import type {Protocol} from 'devtools-protocol';

import type {BrowsingContext, Script} from '../../../protocol/protocol.js';
import type {LoggerFn} from '../../../utils/log.js';
import {uuidv4} from '../../../utils/uuid.js';
import type {CdpTarget} from '../context/CdpTarget.js';

import {ChannelProxy} from './ChannelProxy.js';

type CdpPreloadScript = {
  /** CDP target. Includes session ID and target ID. */
  target: CdpTarget;
  /** CDP preload script ID. */
  preloadScriptId: Script.PreloadScript;
};

/**
 * BiDi IDs are generated by the server and are unique within contexts.
 *
 * CDP preload script IDs are generated by the client and are unique
 * within sessions.
 *
 * The mapping between BiDi and CDP preload script IDs is 1:many.
 * BiDi IDs are needed by the mapper to keep track of potential multiple CDP IDs
 * in the client.
 */
export class PreloadScript {
  /** BiDi ID, an automatically generated UUID. */
  readonly #id: string = uuidv4();
  /** CDP preload scripts. */
  #cdpPreloadScripts: CdpPreloadScript[] = [];
  /** The script itself, in a format expected by the spec i.e. a function. */
  readonly #functionDeclaration: string;
  /** Targets, in which the preload script is initialized. */
  readonly #targetIds = new Set<Protocol.Target.TargetID>();
  /** Channels to be added as arguments to functionDeclaration. */
  readonly #channels: ChannelProxy[];
  /** The script sandbox / world name. */
  readonly #sandbox?: string;
  /** The browsing contexts to execute the preload scripts in, if any. */
  readonly #contexts?: BrowsingContext.BrowsingContext[];

  get id(): string {
    return this.#id;
  }

  get targetIds(): Set<Protocol.Target.TargetID> {
    return this.#targetIds;
  }

  constructor(params: Script.AddPreloadScriptParameters, logger?: LoggerFn) {
    this.#channels =
      params.arguments?.map((a) => new ChannelProxy(a.value, logger)) ?? [];
    this.#functionDeclaration = params.functionDeclaration;
    this.#sandbox = params.sandbox;
    this.#contexts = params.contexts;
  }

  /** Channels of the preload script. */
  get channels(): ChannelProxy[] {
    return this.#channels;
  }

  /** Contexts of the preload script, if any */
  get contexts(): BrowsingContext.BrowsingContext[] | undefined {
    return this.#contexts;
  }

  /**
   * String to be evaluated. Wraps user-provided function so that the following
   * steps are run:
   * 1. Create channels.
   * 2. Store the created channels in window.
   * 3. Call the user-provided function with channels as arguments.
   */
  #getEvaluateString() {
    const channelsArgStr = `[${this.channels
      .map((c) => c.getEvalInWindowStr())
      .join(', ')}]`;

    return `(()=>{(${this.#functionDeclaration})(...${channelsArgStr})})()`;
  }

  /**
   * Adds the script to the given CDP targets by calling the
   * `Page.addScriptToEvaluateOnNewDocument` command.
   */
  async initInTargets(
    cdpTargets: Iterable<CdpTarget>,
    runImmediately: boolean
  ) {
    await Promise.all(
      Array.from(cdpTargets).map((cdpTarget) =>
        this.initInTarget(cdpTarget, runImmediately)
      )
    );
  }

  /**
   * Adds the script to the given CDP target by calling the
   * `Page.addScriptToEvaluateOnNewDocument` command.
   */
  async initInTarget(cdpTarget: CdpTarget, runImmediately: boolean) {
    const addCdpPreloadScriptResult = await cdpTarget.cdpClient.sendCommand(
      'Page.addScriptToEvaluateOnNewDocument',
      {
        source: this.#getEvaluateString(),
        worldName: this.#sandbox,
        runImmediately,
      }
    );

    this.#cdpPreloadScripts.push({
      target: cdpTarget,
      preloadScriptId: addCdpPreloadScriptResult.identifier,
    });
    this.#targetIds.add(cdpTarget.targetId);
  }

  /**
   * Removes this script from all CDP targets.
   */
  async remove() {
    for (const cdpPreloadScript of this.#cdpPreloadScripts) {
      const cdpTarget = cdpPreloadScript.target;
      const cdpPreloadScriptId = cdpPreloadScript.preloadScriptId;
      await cdpTarget.cdpClient.sendCommand(
        'Page.removeScriptToEvaluateOnNewDocument',
        {
          identifier: cdpPreloadScriptId,
        }
      );
    }
  }

  /** Removes the provided cdp target from the list of cdp preload scripts. */
  dispose(cdpTargetId: Protocol.Target.TargetID) {
    this.#cdpPreloadScripts = this.#cdpPreloadScripts.filter(
      (cdpPreloadScript) => cdpPreloadScript.target?.targetId !== cdpTargetId
    );
    this.#targetIds.delete(cdpTargetId);
  }
}
