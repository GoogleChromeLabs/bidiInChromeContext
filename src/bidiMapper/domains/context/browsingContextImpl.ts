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

import { Protocol } from 'devtools-protocol';
import { BrowsingContext, Script } from '../protocol/bidiProtocolTypes';
import { CdpClient } from '../../../cdp';
import { IEventManager } from '../events/EventManager';
import LoadEvent = BrowsingContext.LoadEvent;
import { Deferred } from '../../utils/deferred';
import { UnknownErrorResponse } from '../protocol/error';
import { LogManager } from '../log/logManager';
import { IBidiServer } from '../../utils/bidiServer';
import { ScriptEvaluator } from '../script/scriptEvaluator';
import { Realm, RealmType } from '../script/realm';

export type ScriptTarget =
  | { executionContext: number }
  | { sandbox: string | null };

export class BrowsingContextImpl {
  readonly #targetDefers = {
    documentInitialized: new Deferred<void>(),
    targetUnblocked: new Deferred<void>(),
    Page: {
      navigatedWithinDocument:
        new Deferred<Protocol.Page.NavigatedWithinDocumentEvent>(),
      lifecycleEvent: {
        DOMContentLoaded: new Deferred<Protocol.Page.LifecycleEventEvent>(),
        load: new Deferred<Protocol.Page.LifecycleEventEvent>(),
      },
    },
  };

  readonly #contextId: string;
  readonly #parentId: string | null;
  #url: string = 'about:blank';
  #loaderId: string | null = null;

  #cdpSessionId: string;
  #cdpClient: CdpClient;
  readonly #bidiServer: IBidiServer;
  #eventManager: IEventManager;
  readonly #children: Map<string, BrowsingContextImpl> = new Map();
  #scriptEvaluator: ScriptEvaluator;
  // Default execution context is set with key `null`.
  #sandboxToExecutionContextIdMap: Map<
    string | null,
    Protocol.Runtime.ExecutionContextId
  > = new Map();

  constructor(
    contextId: string,
    parentId: string | null,
    cdpClient: CdpClient,
    bidiServer: IBidiServer,
    cdpSessionId: string,
    eventManager: IEventManager
  ) {
    this.#contextId = contextId;
    this.#parentId = parentId;
    this.#cdpClient = cdpClient;
    this.#eventManager = eventManager;
    this.#cdpSessionId = cdpSessionId;
    this.#bidiServer = bidiServer;

    this.#scriptEvaluator = ScriptEvaluator.create(cdpClient);
    this.#initListeners();
  }

  public static createFrameContext(
    contextId: string,
    parentId: string | null,
    cdpClient: CdpClient,
    bidiServer: IBidiServer,
    cdpSessionId: string,
    eventManager: IEventManager
  ): BrowsingContextImpl {
    const context = new BrowsingContextImpl(
      contextId,
      parentId,
      cdpClient,
      bidiServer,
      cdpSessionId,
      eventManager
    );
    context.#targetDefers.targetUnblocked.resolve();
    return context;
  }

  public static createTargetContext(
    contextId: string,
    parentId: string | null,
    cdpClient: CdpClient,
    bidiServer: IBidiServer,
    cdpSessionId: string,
    eventManager: IEventManager
  ): BrowsingContextImpl {
    const context = new BrowsingContextImpl(
      contextId,
      parentId,
      cdpClient,
      bidiServer,
      cdpSessionId,
      eventManager
    );

    // No need in waiting for target to be unblocked.
    // noinspection JSIgnoredPromiseFromCall
    context.#unblockAttachedTarget();

    return context;
  }

  public static convertFrameToTargetContext(
    context: BrowsingContextImpl,
    cdpClient: CdpClient,
    cdpSessionId: string
  ): BrowsingContextImpl {
    context.#updateConnection(cdpClient, cdpSessionId);
    // No need in waiting for target to be unblocked.
    // noinspection JSIgnoredPromiseFromCall
    context.#unblockAttachedTarget();
    return context;
  }

  #updateConnection(cdpClient: CdpClient, cdpSessionId: string) {
    if (!this.#targetDefers.targetUnblocked.isFinished) {
      this.#targetDefers.targetUnblocked.reject('OOPiF');
    }
    this.#targetDefers.targetUnblocked = new Deferred<void>();

    this.#cdpClient = cdpClient;
    this.#cdpSessionId = cdpSessionId;

    this.#scriptEvaluator = ScriptEvaluator.create(cdpClient);
    this.#initListeners();
  }

  async #unblockAttachedTarget() {
    LogManager.create(
      this.#contextId,
      this.#cdpClient,
      this.#bidiServer,
      this.#scriptEvaluator
    );
    await this.#cdpClient.Runtime.enable();
    await this.#cdpClient.Page.enable();
    await this.#cdpClient.Page.setLifecycleEventsEnabled({ enabled: true });
    await this.#cdpClient.Target.setAutoAttach({
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
    });

    await this.#cdpClient.Runtime.runIfWaitingForDebugger();
    this.#targetDefers.targetUnblocked.resolve();
  }

  get contextId(): string {
    return this.#contextId;
  }

  get parentId(): string | null {
    return this.#parentId;
  }

  get cdpSessionId(): string {
    return this.#cdpSessionId;
  }

  get children(): BrowsingContextImpl[] {
    return Array.from(this.#children.values());
  }

  get url(): string {
    return this.#url;
  }

  addChild(child: BrowsingContextImpl): void {
    this.#children.set(child.contextId, child);
  }

  removeChild(childContextId: string): void {
    this.#children.delete(childContextId);
  }

  async awaitLoaded(): Promise<void> {
    await this.#targetDefers.Page.lifecycleEvent.load;
  }

  public serializeToBidiValue(
    maxDepth: number,
    isRoot: boolean
  ): BrowsingContext.Info {
    return {
      context: this.#contextId,
      url: this.url,
      children:
        maxDepth > 0
          ? this.children.map((c) =>
              c.serializeToBidiValue(maxDepth - 1, false)
            )
          : null,
      ...(isRoot ? { parent: this.#parentId } : {}),
    };
  }

  #initListeners() {
    this.#cdpClient.Target.on(
      'targetInfoChanged',
      (params: Protocol.Target.TargetInfoChangedEvent) => {
        if (this.contextId !== params.targetInfo.targetId) {
          return;
        }
        this.#url = params.targetInfo.url;
      }
    );

    this.#cdpClient.Page.on(
      'frameNavigated',
      (params: Protocol.Page.FrameNavigatedEvent) => {
        if (this.contextId !== params.frame.id) {
          return;
        }
        this.#url = params.frame.url + (params.frame.urlFragment ?? '');

        // Remove all the already created realms.
        Realm.getRealms({ browsingContextId: this.contextId }).map((realm) =>
          Realm.removeRealm(realm.realmId)
        );
        this.#sandboxToExecutionContextIdMap = new Map();
      }
    );

    this.#cdpClient.Page.on(
      'navigatedWithinDocument',
      (params: Protocol.Page.NavigatedWithinDocumentEvent) => {
        if (this.contextId !== params.frameId) {
          return;
        }

        this.#url = params.url;
        this.#targetDefers.Page.navigatedWithinDocument.resolve(params);
      }
    );

    this.#cdpClient.Page.on(
      'lifecycleEvent',
      async (params: Protocol.Page.LifecycleEventEvent) => {
        if (this.contextId !== params.frameId) {
          return;
        }

        if (params.name === 'init') {
          this.#documentChanged(params.loaderId);
          this.#targetDefers.documentInitialized.resolve();
        }

        if (params.name === 'commit') {
          this.#loaderId = params.loaderId;
          return;
        }

        if (params.loaderId !== this.#loaderId) {
          return;
        }

        switch (params.name) {
          case 'DOMContentLoaded':
            this.#targetDefers.Page.lifecycleEvent.DOMContentLoaded.resolve(
              params
            );
            await this.#eventManager.sendEvent(
              new BrowsingContext.DomContentLoadedEvent({
                context: this.contextId,
                navigation: this.#loaderId,
                url: this.#url,
              }),
              this.contextId
            );
            break;

          case 'load':
            this.#targetDefers.Page.lifecycleEvent.load.resolve(params);
            await this.#eventManager.sendEvent(
              new LoadEvent({
                context: this.contextId,
                navigation: this.#loaderId,
                url: this.#url,
              }),
              this.contextId
            );
            break;
        }
      }
    );

    this.#cdpClient.Runtime.on(
      'executionContextCreated',
      (params: Protocol.Runtime.ExecutionContextCreatedEvent) => {
        try {
          if (params.context.auxData.frameId !== this.contextId) {
            return;
          }
          if (params.context.auxData.isDefault) {
            // Default execution context is set with key `null`.
            this.#sandboxToExecutionContextIdMap.set(null, params.context.id);
          }
          if (params.context.name !== undefined) {
            this.#sandboxToExecutionContextIdMap.set(
              params.context.name,
              params.context.id
            );
          }

          Realm.registerRealm(
            new Realm(
              params.context.uniqueId,
              this.contextId,
              params.context.id,
              this.#getOrigin(params),
              // TODO: differentiate types.
              RealmType.window,
              params.context.name ?? null
            )
          );
        } catch (e) {
          console.log('!!@@## ' + JSON.stringify(e));
        }
      }
    );
    this.#cdpClient.Runtime.on(
      'executionContextDestroyed',
      (params: Protocol.Runtime.ExecutionContextDestroyedEvent) => {
        const realmId = Realm.getRealmId(
          this.contextId,
          params.executionContextId
        );
        Realm.removeRealm(realmId);
      }
    );
  }

  #getOrigin(params: Protocol.Runtime.ExecutionContextCreatedEvent) {
    if (params.context.auxData.type === 'isolated') {
      // Sandbox should have the same origin as the context itself, but in CDP it
      // has an empty one. Get oro
      const defaultRealm = Realm.getRealm(
        Realm.getRealmId(
          this.contextId,
          this.#sandboxToExecutionContextIdMap.get(null)!
        )
      );

      return defaultRealm.origin;
    }
    // https://html.spec.whatwg.org/multipage/origin.html#ascii-serialisation-of-an-origin
    return ['://', ''].includes(params.context.origin)
      ? 'null'
      : params.context.origin;
  }

  #documentChanged(loaderId: string) {
    if (this.#loaderId === loaderId) {
      return;
    }

    if (!this.#targetDefers.documentInitialized.isFinished) {
      this.#targetDefers.documentInitialized.reject('Document changed');
    }
    this.#targetDefers.documentInitialized = new Deferred<void>();

    if (!this.#targetDefers.Page.navigatedWithinDocument.isFinished) {
      this.#targetDefers.Page.navigatedWithinDocument.reject(
        'Document changed'
      );
    }
    this.#targetDefers.Page.navigatedWithinDocument =
      new Deferred<Protocol.Page.NavigatedWithinDocumentEvent>();

    if (!this.#targetDefers.Page.lifecycleEvent.DOMContentLoaded.isFinished) {
      this.#targetDefers.Page.lifecycleEvent.DOMContentLoaded.reject(
        'Document changed'
      );
    }
    this.#targetDefers.Page.lifecycleEvent.DOMContentLoaded =
      new Deferred<Protocol.Page.LifecycleEventEvent>();

    if (!this.#targetDefers.Page.lifecycleEvent.load.isFinished) {
      this.#targetDefers.Page.lifecycleEvent.load.reject('Document changed');
    }
    this.#targetDefers.Page.lifecycleEvent.load =
      new Deferred<Protocol.Page.LifecycleEventEvent>();

    this.#loaderId = loaderId;
  }

  async navigate(
    url: string,
    wait: BrowsingContext.ReadinessState
  ): Promise<BrowsingContext.NavigateResult> {
    await this.#targetDefers.targetUnblocked;

    // TODO: handle loading errors.
    const cdpNavigateResult = await this.#cdpClient.Page.navigate({
      url,
      frameId: this.contextId,
    });

    if (cdpNavigateResult.errorText) {
      throw new UnknownErrorResponse(cdpNavigateResult.errorText);
    }

    if (
      cdpNavigateResult.loaderId !== undefined &&
      cdpNavigateResult.loaderId !== this.#loaderId
    ) {
      this.#documentChanged(cdpNavigateResult.loaderId);
    }

    // Wait for `wait` condition.
    switch (wait) {
      case 'none':
        break;

      case 'interactive':
        // No `loaderId` means same-document navigation.
        if (cdpNavigateResult.loaderId === undefined) {
          await this.#targetDefers.Page.navigatedWithinDocument;
        } else {
          await this.#targetDefers.Page.lifecycleEvent.DOMContentLoaded;
        }
        break;

      case 'complete':
        // No `loaderId` means same-document navigation.
        if (cdpNavigateResult.loaderId === undefined) {
          await this.#targetDefers.Page.navigatedWithinDocument;
        } else {
          await this.#targetDefers.Page.lifecycleEvent.load;
        }
        break;

      default:
        throw new Error(`Not implemented wait '${wait}'`);
    }

    return {
      result: {
        navigation: cdpNavigateResult.loaderId || null,
        url: url,
      },
    };
  }

  async #getExecutionContext(
    target: ScriptTarget
  ): Promise<Protocol.Runtime.ExecutionContextId> {
    if ('sandbox' in target) {
      return await this.#getOrCreateSandbox(target.sandbox);
    }
    return target.executionContext;
  }

  async callFunction(
    functionDeclaration: string,
    _this: Script.ArgumentValue,
    _arguments: Script.ArgumentValue[],
    target: ScriptTarget,
    awaitPromise: boolean,
    resultOwnership: Script.OwnershipModel
  ): Promise<Script.CallFunctionResult> {
    await this.#targetDefers.targetUnblocked;

    const executionContext = await this.#getExecutionContext(target);

    return {
      result: await this.#scriptEvaluator.callFunction(
        this.contextId,
        executionContext,
        functionDeclaration,
        _this,
        _arguments,
        awaitPromise,
        resultOwnership
      ),
    };
  }

  async scriptEvaluate(
    expression: string,
    target: ScriptTarget,
    awaitPromise: boolean,
    resultOwnership: Script.OwnershipModel
  ): Promise<Script.EvaluateResult> {
    await this.#targetDefers.targetUnblocked;

    const executionContext = await this.#getExecutionContext(target);

    return this.#scriptEvaluator.scriptEvaluate(
      this.contextId,
      executionContext,
      expression,
      awaitPromise,
      resultOwnership
    );
  }

  async findElement(
    selector: string
  ): Promise<BrowsingContext.PROTO.FindElementResult> {
    await this.#targetDefers.targetUnblocked;

    const functionDeclaration = String((resultsSelector: string) =>
      document.querySelector(resultsSelector)
    );
    const _arguments: Script.ArgumentValue[] = [
      { type: 'string', value: selector },
    ];

    // TODO(sadym): handle not found exception.
    const result = await this.callFunction(
      functionDeclaration,
      {
        type: 'undefined',
      },
      _arguments,
      // TODO: execute in isolated world.
      { sandbox: null },
      true,
      'root'
    );

    // TODO(sadym): handle type properly.
    return result as any as BrowsingContext.PROTO.FindElementResult;
  }

  async #getOrCreateSandbox(
    sandbox: string | null
  ): Promise<Protocol.Runtime.ExecutionContextId> {
    if (!this.#sandboxToExecutionContextIdMap.has(sandbox)) {
      // Default execution context is set with key `null`.
      if (sandbox === null) {
        throw Error('No default execution context');
      }
      const resp = await this.#cdpClient.Page.createIsolatedWorld({
        frameId: this.contextId,
        worldName: sandbox,
      });
      this.#sandboxToExecutionContextIdMap.set(
        sandbox,
        resp.executionContextId
      );
    }

    return this.#sandboxToExecutionContextIdMap.get(sandbox)!;
  }
}
