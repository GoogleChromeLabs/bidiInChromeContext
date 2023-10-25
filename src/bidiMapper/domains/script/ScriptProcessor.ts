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

import {
  type EmptyResult,
  Script,
  NoSuchScriptException,
  InvalidArgumentException,
} from '../../../protocol/protocol';
import type {LoggerFn} from '../../../utils/log';
import type {BrowsingContextStorage} from '../context/BrowsingContextStorage';
import type {CdpTarget} from '../context/CdpTarget';
import type {BrowsingContextImpl} from '../context/BrowsingContextImpl';

import type {PreloadScriptStorage} from './PreloadScriptStorage';
import {PreloadScript} from './PreloadScript';
import type {Realm} from './Realm';
import type {RealmStorage} from './RealmStorage';

export class ScriptProcessor {
  readonly #browsingContextStorage: BrowsingContextStorage;
  readonly #realmStorage: RealmStorage;
  readonly #preloadScriptStorage;
  readonly #logger?: LoggerFn;

  constructor(
    browsingContextStorage: BrowsingContextStorage,
    realmStorage: RealmStorage,
    preloadScriptStorage: PreloadScriptStorage,
    logger?: LoggerFn
  ) {
    this.#browsingContextStorage = browsingContextStorage;
    this.#realmStorage = realmStorage;
    this.#preloadScriptStorage = preloadScriptStorage;
    this.#logger = logger;
  }

  async addPreloadScript(
    params: Script.AddPreloadScriptParameters
  ): Promise<Script.AddPreloadScriptResult> {
    const contexts = new Set<BrowsingContextImpl>();
    if (params.contexts) {
      // XXX: Remove once https://github.com/google/cddlconv/issues/16 is implemented
      if (params.contexts.length === 0) {
        throw new InvalidArgumentException('Contexts list is empty.');
      }

      for (const contextId of params.contexts) {
        const context = this.#browsingContextStorage.getContext(contextId);
        if (context.isTopLevelContext()) {
          contexts.add(context);
        } else {
          throw new InvalidArgumentException(
            `Non top-level context '${contextId}' given.`
          );
        }
      }
    }

    const preloadScript = new PreloadScript(params, this.#logger);
    this.#preloadScriptStorage.add(preloadScript);

    const cdpTargets =
      contexts.size === 0
        ? new Set<CdpTarget>(
            this.#browsingContextStorage
              .getTopLevelContexts()
              .map((context) => context.cdpTarget)
          )
        : new Set<CdpTarget>(
            [...contexts.values()].map((context) => context.cdpTarget)
          );

    await preloadScript.initInTargets(cdpTargets, false);

    return {
      script: preloadScript.id,
    };
  }

  async removePreloadScript(
    params: Script.RemovePreloadScriptParameters
  ): Promise<EmptyResult> {
    const bidiId = params.script;

    const scripts = this.#preloadScriptStorage.find({
      id: bidiId,
    });

    if (scripts.length === 0) {
      throw new NoSuchScriptException(
        `No preload script with BiDi ID '${bidiId}'`
      );
    }

    await Promise.all(scripts.map((script) => script.remove()));

    this.#preloadScriptStorage.remove({
      id: bidiId,
    });

    return {};
  }

  async callFunction(
    params: Script.CallFunctionParameters
  ): Promise<Script.EvaluateResult> {
    const realm = await this.#getRealm(params.target);
    return await realm.callFunction(
      params.functionDeclaration,
      params.this ?? {
        type: 'undefined',
      }, // `this` is `undefined` by default.
      params.arguments ?? [], // `arguments` is `[]` by default.
      params.awaitPromise,
      params.resultOwnership ?? Script.ResultOwnership.None,
      params.serializationOptions ?? {},
      params.userActivation ?? false
    );
  }

  async evaluate(
    params: Script.EvaluateParameters
  ): Promise<Script.EvaluateResult> {
    const realm = await this.#getRealm(params.target);
    return await realm.evaluate(
      params.expression,
      params.awaitPromise,
      params.resultOwnership ?? Script.ResultOwnership.None,
      params.serializationOptions ?? {},
      params.userActivation ?? false
    );
  }

  async disown(params: Script.DisownParameters): Promise<EmptyResult> {
    const realm = await this.#getRealm(params.target);
    await Promise.all(
      params.handles.map(async (handle) => await realm.disown(handle))
    );
    return {};
  }

  getRealms(params: Script.GetRealmsParameters): Script.GetRealmsResult {
    if (params.context !== undefined) {
      // Make sure the context is known.
      this.#browsingContextStorage.getContext(params.context);
    }
    const realms = this.#realmStorage
      .findRealms({
        browsingContextId: params.context,
        type: params.type,
      })
      .map((realm: Realm) => realm.realmInfo);
    return {realms};
  }

  async #getRealm(target: Script.Target): Promise<Realm> {
    if ('realm' in target) {
      return this.#realmStorage.getRealm({
        realmId: target.realm,
      });
    }
    const context = this.#browsingContextStorage.getContext(target.context);
    return await context.getOrCreateSandbox(target.sandbox);
  }
}
