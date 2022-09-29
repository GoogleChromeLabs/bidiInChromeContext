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
import { BrowsingContextStorage } from './browsingContextStorage';

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

  #maybeDefaultRealm: Realm | undefined;

  get #defaultRealm(): Realm {
    if (this.#maybeDefaultRealm === undefined) {
      throw new Error(
        `No default realm for browsing context ${this.#contextId}`
      );
    }
    return this.#maybeDefaultRealm;
  }

  private constructor(
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

    this.#initListeners();

    BrowsingContextStorage.registerContext(this);
  }

  public static async createFrameContext(
    contextId: string,
    parentId: string | null,
    cdpClient: CdpClient,
    bidiServer: IBidiServer,
    cdpSessionId: string,
    eventManager: IEventManager
  ): Promise<BrowsingContextImpl> {
    const context = new BrowsingContextImpl(
      contextId,
      parentId,
      cdpClient,
      bidiServer,
      cdpSessionId,
      eventManager
    );
    context.#targetDefers.targetUnblocked.resolve();

    await eventManager.sendEvent(
      new BrowsingContext.ContextCreatedEvent(
        context.serializeToBidiValue(0, true)
      ),
      context.contextId
    );

    return context;
  }

  public static async createTargetContext(
    contextId: string,
    parentId: string | null,
    cdpClient: CdpClient,
    bidiServer: IBidiServer,
    cdpSessionId: string,
    eventManager: IEventManager
  ): Promise<BrowsingContextImpl> {
    const context = new BrowsingContextImpl(
      contextId,
      parentId,
      cdpClient,
      bidiServer,
      cdpSessionId,
      eventManager
    );

    // No need in waiting for target to be unblocked.
    // noinspection ES6MissingAwait
    context.#unblockAttachedTarget();

    await eventManager.sendEvent(
      new BrowsingContext.ContextCreatedEvent(
        context.serializeToBidiValue(0, true)
      ),
      context.contextId
    );

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

  public async removeChildContexts() {
    await Promise.all(this.children.map((child) => child.remove()));
  }

  public async remove() {
    await this.removeChildContexts();

    // Remove context from the parent.
    if (this.parentId !== null) {
      const parent = BrowsingContextStorage.getKnownContext(this.parentId);
      parent.#children.delete(this.contextId);
    }

    await this.#eventManager.sendEvent(
      new BrowsingContext.ContextDestroyedEvent(
        this.serializeToBidiValue(0, true)
      ),
      this.contextId
    );
    BrowsingContextStorage.forgetContext(this.contextId);
  }

  #updateConnection(cdpClient: CdpClient, cdpSessionId: string) {
    if (!this.#targetDefers.targetUnblocked.isFinished) {
      this.#targetDefers.targetUnblocked.reject('OOPiF');
    }
    this.#targetDefers.targetUnblocked = new Deferred<void>();

    this.#cdpClient = cdpClient;
    this.#cdpSessionId = cdpSessionId;

    this.#initListeners();
  }

  async #unblockAttachedTarget() {
    LogManager.create(
      this.#contextId,
      this.#cdpClient,
      this.#cdpSessionId,
      this.#bidiServer
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

  async awaitLoaded(): Promise<void> {
    await this.#targetDefers.Page.lifecycleEvent.load;
  }

  async awaitUnblocked(): Promise<void> {
    await this.#targetDefers.targetUnblocked;
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
      async (params: Protocol.Page.FrameNavigatedEvent) => {
        if (this.contextId !== params.frame.id) {
          return;
        }
        this.#url = params.frame.url + (params.frame.urlFragment ?? '');

        // At the point the page is initiated, all the nested iframes from the
        // previous page are detached and realms are destroyed.
        // Remove context's children.
        await this.removeChildContexts();

        // Remove all the already created realms.
        Realm.clearBrowsingContext(this.contextId);
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
        if (params.context.auxData.frameId !== this.contextId) {
          return;
        }
        // Only this execution contexts are supported for now.
        if (!['default', 'isolated'].includes(params.context.auxData.type)) {
          return;
        }
        const realm = Realm.create(
          params.context.uniqueId,
          this.contextId,
          params.context.id,
          this.#getOrigin(params),
          // TODO: differentiate types.
          RealmType.window,
          // Sandbox name for isolated world.
          params.context.auxData.type === 'isolated'
            ? params.context.name
            : undefined,
          this.#cdpSessionId,
          this.#cdpClient
        );

        if (params.context.auxData.isDefault) {
          this.#maybeDefaultRealm = realm;
        }
      }
    );

    this.#cdpClient.Runtime.on(
      'executionContextDestroyed',
      (params: Protocol.Runtime.ExecutionContextDestroyedEvent) => {
        const realmId = Realm.findRealms({
          browsingContextId: this.contextId,
          executionContextId: params.executionContextId,
        }).map((realm) => realm.remove());
      }
    );
  }

  #getOrigin(params: Protocol.Runtime.ExecutionContextCreatedEvent) {
    if (params.context.auxData.type === 'isolated') {
      // Sandbox should have the same origin as the context itself, but in CDP
      // it has an empty one.
      return this.#defaultRealm.origin;
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
    const result = await this.#defaultRealm.callFunction(
      functionDeclaration,
      {
        type: 'undefined',
      },
      _arguments,
      // TODO: execute in isolated world.
      true,
      'root'
    );

    // TODO(sadym): handle type properly.
    return result as any as BrowsingContext.PROTO.FindElementResult;
  }

  async getOrCreateSandbox(sandbox: string | undefined): Promise<Realm> {
    if (sandbox === undefined) {
      return this.#defaultRealm;
    }

    let maybeSandbox = Realm.findRealms({
      browsingContextId: this.contextId,
      sandbox,
    });

    if (maybeSandbox.length == 0) {
      await this.#cdpClient.Page.createIsolatedWorld({
        frameId: this.contextId,
        worldName: sandbox,
      });
      // `Runtime.executionContextCreated` should be emitted by the time the
      // previous command is done.
      maybeSandbox = Realm.findRealms({
        browsingContextId: this.contextId,
        sandbox,
      });
    }
    if (maybeSandbox.length !== 1) {
      throw Error(`Sandbox ${sandbox} wasn't created.`);
    }
    return Realm.findRealms({
      browsingContextId: this.contextId,
      sandbox,
    })[0];
  }
}
