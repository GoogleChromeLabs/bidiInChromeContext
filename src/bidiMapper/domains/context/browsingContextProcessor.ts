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

import { log } from '../../../utils/log';
import { CdpClient, CdpConnection } from '../../../cdp';
import { TargetContext } from './targetContext';
import { BrowsingContext, CDP, Script } from '../protocol/bidiProtocolTypes';
import Protocol from 'devtools-protocol';
import { IBidiServer } from '../../utils/bidiServer';
import { IEventManager } from '../events/EventManager';
import { InvalidArgumentErrorResponse } from '../protocol/error';
import { Context } from './context';

const logContext = log('context');

export class BrowsingContextProcessor {
  // Set from outside.
  private _cdpConnection: CdpConnection;

  constructor(
    cdpConnection: CdpConnection,
    private _selfTargetId: string,
    private _bidiServer: IBidiServer,
    private _eventManager: IEventManager
  ) {
    this._cdpConnection = cdpConnection;

    this._setCdpEventListeners(this._cdpConnection.browserClient());
  }

  private _setCdpEventListeners(browserCdpClient: CdpClient) {
    browserCdpClient.Target.on('attachedToTarget', async (params) => {
      await this._handleAttachedToTargetEvent(params);
    });
    browserCdpClient.Target.on('detachedFromTarget', async (params) => {
      await this._handleDetachedFromTargetEvent(params);
    });
  }

  private async _handleAttachedToTargetEvent(
    params: Protocol.Target.AttachedToTargetEvent
  ) {
    logContext('AttachedToTarget event received: ' + JSON.stringify(params));

    const { sessionId, targetInfo } = params;
    if (!this._isValidTarget(targetInfo)) {
      return;
    }

    // Already attached to the target.
    if (Context.hasKnownContext(targetInfo.targetId)) {
      return;
    }

    const context = await TargetContext.create(
      targetInfo,
      sessionId,
      this._cdpConnection,
      this._bidiServer,
      this._eventManager
    );

    Context.addContext(context);

    await this._eventManager.sendEvent(
      new BrowsingContext.ContextCreatedEvent({
        context: context.getContextId(),
        parent: targetInfo.openerId ? targetInfo.openerId : null,
        // New-opened context `url` is always `about:blank`:
        // https://github.com/w3c/webdriver-bidi/issues/220
        url: 'about:blank',
        // New-opened `children` are always empty:
        // https://github.com/w3c/webdriver-bidi/issues/220
        children: [],
      }),
      context.getContextId()
    );
  }

  // { "method": "Target.detachedFromTarget",
  //   "params": {
  //     "sessionId": "7EFBFB2A4942A8989B3EADC561BC46E9",
  //     "targetId": "19416886405CBA4E03DBB59FA67FF4E8" } }
  private async _handleDetachedFromTargetEvent(
    params: Protocol.Target.DetachedFromTargetEvent
  ) {
    logContext('detachedFromTarget event received: ' + JSON.stringify(params));

    // TODO: params.targetId is deprecated. Update this class to track using
    // params.sessionId instead.
    // https://github.com/GoogleChromeLabs/chromium-bidi/issues/60
    const contextId = params.targetId!;
    if (!Context.hasKnownContext(contextId)) {
      return;
    }
    const context = Context.getKnownContext(contextId);
    Context.removeContext(contextId);
    await this._eventManager.sendEvent(
      new BrowsingContext.ContextDestroyedEvent(
        context.serializeToBidiValue(0)
      ),
      contextId
    );
  }

  async process_browsingContext_getTree(
    params: BrowsingContext.GetTreeParameters
  ): Promise<BrowsingContext.GetTreeResult> {
    return {
      result: {
        contexts: Context.getContexts(params.root)
          .filter((c) => c.getParentId() === null)
          .map((c) =>
            c.serializeToBidiValue(params.maxDepth ?? Number.MAX_VALUE)
          ),
      },
    };
  }

  async process_browsingContext_create(
    params: BrowsingContext.CreateParameters
  ): Promise<BrowsingContext.CreateResult> {
    const browserCdpClient = this._cdpConnection.browserClient();

    const result = await browserCdpClient.Target.createTarget({
      url: 'about:blank',
      newWindow: params.type === 'window',
    });

    return {
      result: {
        context: result.targetId,
        parent: null,
        url: 'about:blank',
        children: [],
      },
    };
  }

  async process_browsingContext_navigate(
    params: BrowsingContext.NavigateParameters
  ): Promise<BrowsingContext.NavigateResult> {
    const context = Context.getKnownContext(params.context);

    return await context.navigate(
      params.url,
      params.wait !== undefined ? params.wait : 'none'
    );
  }

  async process_script_evaluate(
    params: Script.EvaluateParameters
  ): Promise<Script.EvaluateResult> {
    const context = Context.getKnownContext(
      (params.target as Script.ContextTarget).context
    );
    return await context.scriptEvaluate(
      params.expression,
      params.awaitPromise !== false // `awaitPromise` by default is `true`.
    );
  }

  async process_script_callFunction(
    params: Script.CallFunctionParameters
  ): Promise<Script.CallFunctionResult> {
    const context = Context.getKnownContext(
      (params.target as Script.ContextTarget).context
    );
    return await context.callFunction(
      params.functionDeclaration,
      params.this || {
        type: 'undefined',
      }, // `this` is `undefined` by default.
      params.arguments || [], // `arguments` is `[]` by default.
      params.awaitPromise !== false // `awaitPromise` is `true` by default.
    );
  }

  async process_PROTO_browsingContext_findElement(
    params: BrowsingContext.PROTO.FindElementParameters
  ): Promise<BrowsingContext.PROTO.FindElementResult> {
    const context = Context.getKnownContext(params.context);
    return await context.findElement(params.selector);
  }

  async process_browsingContext_close(
    commandParams: BrowsingContext.CloseParameters
  ): Promise<BrowsingContext.CloseResult> {
    const browserCdpClient = this._cdpConnection.browserClient();

    const context = Context.getKnownContext(commandParams.context);
    if (context.getParentId() !== null) {
      throw new InvalidArgumentErrorResponse(
        'Not a top-level browsing context cannot be closed.'
      );
    }

    const detachedFromTargetPromise = new Promise<void>(async (resolve) => {
      const onContextDestroyed = (
        eventParams: Protocol.Target.DetachedFromTargetEvent
      ) => {
        if (eventParams.targetId === commandParams.context) {
          browserCdpClient.Target.removeListener(
            'detachedFromTarget',
            onContextDestroyed
          );
          resolve();
        }
      };
      browserCdpClient.Target.on('detachedFromTarget', onContextDestroyed);
    });

    await this._cdpConnection.browserClient().Target.closeTarget({
      targetId: commandParams.context,
    });

    // Sometimes CDP command finishes before `detachedFromTarget` event,
    // sometimes after. Wait for the CDP command to be finished, and then wait
    // for `detachedFromTarget` if it hasn't emitted.
    await detachedFromTargetPromise;

    return { result: {} };
  }

  private _isValidTarget(target: Protocol.Target.TargetInfo) {
    if (target.targetId === this._selfTargetId) {
      return false;
    }
    if (!target.type || target.type !== 'page') {
      return false;
    }
    return true;
  }

  async process_PROTO_cdp_sendCommand(params: CDP.PROTO.SendCommandParams) {
    const sendCdpCommandResult = await this._cdpConnection.sendCommand(
      params.cdpMethod,
      params.cdpParams,
      params.cdpSession ?? null
    );
    return { result: sendCdpCommandResult };
  }

  async process_PROTO_cdp_getSession(params: CDP.PROTO.GetSessionParams) {
    const context = params.context;
    const sessionId = Context.getKnownContext(context).getSessionId();
    if (sessionId === undefined) {
      return { result: { session: null } };
    }
    return { result: { session: sessionId } };
  }
}
