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
import type Protocol from 'devtools-protocol';

import type {ICdpClient} from '../../../cdp/cdpClient.js';
import {
  CdpConnection,
  type ICdpConnection,
} from '../../../cdp/cdpConnection.js';
import {
  BrowsingContext,
  InvalidArgumentException,
  type EmptyResult,
} from '../../../protocol/protocol.js';
import {eat} from '../../../utils/decorators.js';
import {LogType, LoggerSym, type LoggerFn} from '../../../utils/log.js';
import {EventManager} from '../events/EventManager.js';
import {PreloadScriptStorage} from '../script/PreloadScriptStorage.js';
import {RealmStorage} from '../script/realmStorage.js';

import {BrowsingContextImpl} from './browsingContextImpl.js';
import {BrowsingContextStorage} from './browsingContextStorage.js';
import {CdpTarget} from './cdpTarget.js';

export class BrowsingContextProcessor {
  #connection!: ICdpConnection;

  @eat(CdpConnection)
  // @ts-expect-error This is used by the decorator.
  set #_connection(connection: ICdpConnection) {
    this.#connection = connection;
    this.#setEventListeners(this.#connection.browserClient());
  }

  @eat(BrowsingContextStorage)
  readonly #browsingContextStorage!: BrowsingContextStorage;
  @eat(EventManager)
  readonly #eventManager!: EventManager;
  @eat(LoggerSym)
  readonly #logger!: LoggerFn | undefined;
  @eat(PreloadScriptStorage)
  readonly #preloadScriptStorage!: PreloadScriptStorage;
  @eat(RealmStorage)
  readonly #realmStorage!: RealmStorage;

  readonly #selfTargetId: string;

  constructor(selfTargetId: string) {
    this.#selfTargetId = selfTargetId;
  }

  getTree(
    params: BrowsingContext.GetTreeParameters
  ): BrowsingContext.GetTreeResult {
    const resultContexts =
      params.root === undefined
        ? this.#browsingContextStorage.getTopLevelContexts()
        : [this.#browsingContextStorage.getContext(params.root)];

    return {
      contexts: resultContexts.map((c) =>
        c.serializeToBidiValue(params.maxDepth ?? Number.MAX_VALUE)
      ),
    };
  }

  async create(
    params: BrowsingContext.CreateParameters
  ): Promise<BrowsingContext.CreateResult> {
    const browserCdpClient = this.#connection.browserClient();

    let referenceContext: BrowsingContextImpl | undefined;
    if (params.referenceContext !== undefined) {
      referenceContext = this.#browsingContextStorage.getContext(
        params.referenceContext
      );
      if (!referenceContext.isTopLevelContext()) {
        throw new InvalidArgumentException(
          `referenceContext should be a top-level context`
        );
      }
    }

    let result: Protocol.Target.CreateTargetResponse;

    switch (params.type) {
      case BrowsingContext.CreateType.Tab:
        result = await browserCdpClient.sendCommand('Target.createTarget', {
          url: 'about:blank',
          newWindow: false,
        });
        break;
      case BrowsingContext.CreateType.Window:
        result = await browserCdpClient.sendCommand('Target.createTarget', {
          url: 'about:blank',
          newWindow: true,
        });
        break;
    }

    // Wait for the new tab to be loaded to avoid race conditions in the
    // `browsingContext` events, when the `browsingContext.domContentLoaded` and
    // `browsingContext.load` events from the initial `about:blank` navigation
    // are emitted after the next navigation is started.
    // Details: https://github.com/web-platform-tests/wpt/issues/35846
    const contextId = result.targetId;
    const context = this.#browsingContextStorage.getContext(contextId);
    await context.lifecycleLoaded();

    return {context: context.id};
  }

  navigate(
    params: BrowsingContext.NavigateParameters
  ): Promise<BrowsingContext.NavigateResult> {
    const context = this.#browsingContextStorage.getContext(params.context);

    return context.navigate(
      params.url,
      params.wait ?? BrowsingContext.ReadinessState.None
    );
  }

  reload(params: BrowsingContext.ReloadParameters): Promise<EmptyResult> {
    const context = this.#browsingContextStorage.getContext(params.context);

    return context.reload(
      params.ignoreCache ?? false,
      params.wait ?? BrowsingContext.ReadinessState.None
    );
  }

  async activate(
    params: BrowsingContext.ActivateParameters
  ): Promise<EmptyResult> {
    const context = this.#browsingContextStorage.getContext(params.context);
    if (!context.isTopLevelContext()) {
      throw new InvalidArgumentException(
        'Activation is only supported on the top-level context'
      );
    }
    await context.activate();
    return {};
  }

  async captureScreenshot(
    params: BrowsingContext.CaptureScreenshotParameters
  ): Promise<BrowsingContext.CaptureScreenshotResult> {
    const context = this.#browsingContextStorage.getContext(params.context);
    return context.captureScreenshot();
  }

  async print(
    params: BrowsingContext.PrintParameters
  ): Promise<BrowsingContext.PrintResult> {
    const context = this.#browsingContextStorage.getContext(params.context);
    return context.print(params);
  }

  async setViewport(
    params: BrowsingContext.SetViewportParameters
  ): Promise<EmptyResult> {
    const context = this.#browsingContextStorage.getContext(params.context);
    if (!context.isTopLevelContext()) {
      throw new InvalidArgumentException(
        'Emulating viewport is only supported on the top-level context'
      );
    }
    await context.setViewport(params.viewport);
    return {};
  }

  async handleUserPrompt(
    params: BrowsingContext.HandleUserPromptParameters
  ): Promise<EmptyResult> {
    const context = this.#browsingContextStorage.getContext(params.context);
    await context.handleUserPrompt(params);
    return {};
  }

  async close(
    commandParams: BrowsingContext.CloseParameters
  ): Promise<EmptyResult> {
    const context = this.#browsingContextStorage.getContext(
      commandParams.context
    );

    if (!context.isTopLevelContext()) {
      throw new InvalidArgumentException(
        `Non top-level browsing context ${context.id} cannot be closed.`
      );
    }

    try {
      const browserCdpClient = this.#connection.browserClient();
      const detachedFromTargetPromise = new Promise<void>((resolve) => {
        const onContextDestroyed = (
          event: Protocol.Target.DetachedFromTargetEvent
        ) => {
          if (event.targetId === commandParams.context) {
            browserCdpClient.off(
              'Target.detachedFromTarget',
              onContextDestroyed
            );
            resolve();
          }
        };
        browserCdpClient.on('Target.detachedFromTarget', onContextDestroyed);
      });

      await context.close();

      // Sometimes CDP command finishes before `detachedFromTarget` event,
      // sometimes after. Wait for the CDP command to be finished, and then wait
      // for `detachedFromTarget` if it hasn't emitted.
      await detachedFromTargetPromise;
    } catch (error: any) {
      // Swallow error that arise from the page being destroyed
      // Example is navigating to faulty SSL certificate
      if (
        !(
          error.code === -32000 &&
          error.message === 'Not attached to an active page'
        )
      ) {
        throw error;
      }
    }

    return {};
  }

  /**
   * This method is called for each CDP session, since this class is responsible
   * for creating and destroying all targets and browsing contexts.
   */
  #setEventListeners(cdpClient: ICdpClient) {
    cdpClient.on('Target.attachedToTarget', (params) => {
      this.#handleAttachedToTargetEvent(params, cdpClient);
    });
    cdpClient.on('Target.detachedFromTarget', (params) => {
      this.#handleDetachedFromTargetEvent(params);
    });
    cdpClient.on('Target.targetInfoChanged', (params) => {
      this.#handleTargetInfoChangedEvent(params);
    });

    cdpClient.on(
      'Page.frameAttached',
      (params: Protocol.Page.FrameAttachedEvent) => {
        this.#handleFrameAttachedEvent(params);
      }
    );
    cdpClient.on(
      'Page.frameDetached',
      (params: Protocol.Page.FrameDetachedEvent) => {
        this.#handleFrameDetachedEvent(params);
      }
    );
  }

  #handleFrameAttachedEvent(params: Protocol.Page.FrameAttachedEvent) {
    const parentBrowsingContext = this.#browsingContextStorage.findContext(
      params.parentFrameId
    );
    if (parentBrowsingContext !== undefined) {
      BrowsingContextImpl.create(
        parentBrowsingContext.cdpTarget,
        this.#realmStorage,
        params.frameId,
        params.parentFrameId,
        this.#eventManager,
        this.#browsingContextStorage,
        this.#logger
      );
    }
  }

  #handleFrameDetachedEvent(params: Protocol.Page.FrameDetachedEvent) {
    // In case of OOPiF no need in deleting BrowsingContext.
    if (params.reason === 'swap') {
      return;
    }
    this.#browsingContextStorage.findContext(params.frameId)?.dispose();
  }

  #handleAttachedToTargetEvent(
    params: Protocol.Target.AttachedToTargetEvent,
    parentSessionCdpClient: ICdpClient
  ) {
    const {sessionId, targetInfo} = params;

    const targetCdpClient = this.#connection.getCdpClient(sessionId);

    if (!this.#isValidTarget(targetInfo)) {
      // DevTools or some other not supported by BiDi target. Just release
      // debugger  and ignore them.
      targetCdpClient
        .sendCommand('Runtime.runIfWaitingForDebugger')
        .then(() =>
          parentSessionCdpClient.sendCommand('Target.detachFromTarget', params)
        )
        .catch((error) => this.#logger?.(LogType.debug, error));
      return;
    }

    this.#logger?.(
      LogType.debug,
      'AttachedToTarget event received:',
      JSON.stringify(params, null, 2)
    );

    this.#setEventListeners(targetCdpClient);

    const maybeContext = this.#browsingContextStorage.findContext(
      targetInfo.targetId
    );

    const cdpTarget = CdpTarget.create(
      targetInfo.targetId,
      targetCdpClient,
      sessionId,
      this.#realmStorage,
      this.#eventManager,
      this.#preloadScriptStorage
    );

    if (maybeContext) {
      // OOPiF.
      maybeContext.updateCdpTarget(cdpTarget);
    } else {
      // New context.
      BrowsingContextImpl.create(
        cdpTarget,
        this.#realmStorage,
        targetInfo.targetId,
        null,
        this.#eventManager,
        this.#browsingContextStorage,
        this.#logger
      );
    }
  }

  #handleDetachedFromTargetEvent(
    params: Protocol.Target.DetachedFromTargetEvent
  ) {
    // XXX: params.targetId is deprecated. Update this class to track using
    // params.sessionId instead.
    // https://github.com/GoogleChromeLabs/chromium-bidi/issues/60
    const contextId = params.targetId!;
    this.#browsingContextStorage.findContext(contextId)?.dispose();

    this.#preloadScriptStorage
      .findPreloadScripts({targetId: contextId})
      .map((preloadScript) => preloadScript.dispose(contextId));
  }

  #handleTargetInfoChangedEvent(
    params: Protocol.Target.TargetInfoChangedEvent
  ) {
    const contextId = params.targetInfo.targetId;
    this.#browsingContextStorage
      .findContext(contextId)
      ?.onTargetInfoChanged(params);
  }

  #isValidTarget(target: Protocol.Target.TargetInfo) {
    if (target.targetId === this.#selfTargetId) {
      return false;
    }
    return ['page', 'iframe'].includes(target.type);
  }
}
