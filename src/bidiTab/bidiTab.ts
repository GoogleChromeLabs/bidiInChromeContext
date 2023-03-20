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
 *
 * @license
 */

import * as Parser from '../protocol-parser/protocol-parser.js';
import type {
  BrowsingContext,
  CDP,
  Message,
  Script,
  Session,
} from '../protocol/protocol';
import {BidiParser} from '../bidiMapper/CommandProcessor.js';
import {BidiServer} from '../bidiMapper/BidiServer.js';
import {BidiTransport} from '../bidiMapper/bidiMapper.js';
import {CdpConnection} from '../cdp/index.js';
import {ITransport} from '../utils/transport.js';
import {LogType} from '../utils/log.js';
import {OutgoingBidiMessage} from '../bidiMapper/OutgoingBidiMessage.js';

import {generatePage} from './mapperTabPage.js';
import {Logger} from './logger';

declare global {
  interface Window {
    // `window.cdp` is exposed by `Target.exposeDevToolsProtocol` from the server side.
    // https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-exposeDevToolsProtocol
    cdp: {
      send: (message: string) => void;
      onmessage: ((message: string) => void) | null;
    };

    // `window.sendBidiResponse` is exposed by `Runtime.addBinding` from the server side.
    sendBidiResponse: (response: string) => void;

    // `window.onBidiMessage` is called via `Runtime.evaluate` from the server side.
    onBidiMessage: ((message: string) => void) | null;

    // `window.setSelfTargetId` is called via `Runtime.evaluate` from the server side.
    setSelfTargetId: (targetId: string) => void;

    // `window.verboseDebug` is set via `Runtime.evaluate` in case of verbose debugging mode.
    verboseDebugChannel: string | undefined;
  }
}

// Initiate `setSelfTargetId` as soon as possible to prevent race condition.
const waitSelfTargetIdPromise = waitSelfTargetId();
const logger = new Logger();

(async () => {
  generatePage();

  // Needed to filter out info related to BiDi target.
  const selfTargetId = await waitSelfTargetIdPromise;

  const bidiServer = await createBidiServer(selfTargetId, logger);

  logger.setBiDiServer(bidiServer);
  logger.setVerboseDebugChannel(window.verboseDebugChannel);

  logger.log(LogType.system, 'Launched');

  bidiServer.emitOutgoingMessage(
    OutgoingBidiMessage.createResolved({launched: true}, null)
  );
})();

function createCdpConnection() {
  /**
   * A CdpTransport implementation that uses the window.cdp bindings
   * injected by Target.exposeDevToolsProtocol.
   */
  class WindowCdpTransport implements ITransport {
    #onMessage: ((message: string) => void) | null = null;

    constructor() {
      window.cdp.onmessage = (message: string) => {
        this.#onMessage?.call(null, message);
      };
    }

    setOnMessage(onMessage: (message: string) => Promise<void>): void {
      this.#onMessage = onMessage;
    }

    async sendMessage(message: string): Promise<void> {
      window.cdp.send(message);
    }

    close() {
      this.#onMessage = null;
      window.cdp.onmessage = null;
    }
  }

  return new CdpConnection(
    new WindowCdpTransport(),
    (...messages: unknown[]) => {
      logger.log(LogType.cdp, ...messages);
    }
  );
}

async function createBidiServer(selfTargetId: string, logger: Logger) {
  class WindowBidiTransport implements BidiTransport {
    #onMessage: ((message: Message.RawCommandRequest) => void) | null = null;

    constructor() {
      window.onBidiMessage = (messageStr: string) => {
        logger.log(LogType.bidi, 'received ◂', messageStr);
        let messageObject: Message.RawCommandRequest;
        try {
          messageObject = WindowBidiTransport.#parseBidiMessage(messageStr);
        } catch (e: any) {
          // Transport-level error does not provide channel.
          this.#respondWithError(
            messageStr,
            'invalid argument',
            e.message,
            null
          );
          return;
        }
        this.#onMessage?.call(null, messageObject);
      };
    }

    setOnMessage(
      onMessage: (message: Message.RawCommandRequest) => Promise<void>
    ): void {
      this.#onMessage = onMessage;
    }

    async sendMessage(message: Message.OutgoingMessage): Promise<void> {
      const messageStr = JSON.stringify(message);
      window.sendBidiResponse(messageStr);
      logger.log(LogType.bidi, 'sent ▸', messageStr);
    }

    close() {
      this.#onMessage = null;
      window.onBidiMessage = null;
    }

    #respondWithError(
      plainCommandData: string,
      errorCode: Message.ErrorCode,
      errorMessage: string,
      channel: string | null
    ) {
      const errorResponse = WindowBidiTransport.#getErrorResponse(
        plainCommandData,
        errorCode,
        errorMessage
      );

      if (channel) {
        // TODO: get rid of any, same code existed in BidiServer.
        this.sendMessage({
          ...errorResponse,
          channel,
        } as any);
      } else {
        this.sendMessage(errorResponse);
      }
    }

    static #getJsonType(value: unknown) {
      if (value === null) {
        return 'null';
      }
      if (Array.isArray(value)) {
        return 'array';
      }
      return typeof value;
    }

    static #getErrorResponse(
      messageStr: string,
      errorCode: Message.ErrorCode,
      errorMessage: string
    ): Message.OutgoingMessage {
      // TODO: this is bizarre per spec. We reparse the payload and
      // extract the ID, regardless of what kind of value it was.
      let messageId;
      try {
        const messageObj = JSON.parse(messageStr);
        if (
          WindowBidiTransport.#getJsonType(messageObj) === 'object' &&
          'id' in messageObj
        ) {
          messageId = messageObj.id;
        }
      } catch {}

      return {
        id: messageId,
        error: errorCode,
        message: errorMessage,
        // TODO: optional stacktrace field.
      };
    }

    static #parseBidiMessage(messageStr: string): Message.RawCommandRequest {
      let messageObject: Message.RawCommandRequest;
      try {
        messageObject = JSON.parse(messageStr);
      } catch {
        throw new Error('Cannot parse data as JSON');
      }

      const parsedType = WindowBidiTransport.#getJsonType(messageObject);
      if (parsedType !== 'object') {
        throw new Error(`Expected JSON object but got ${parsedType}`);
      }

      // Extract and validate id, method and params.
      const {id, method, params} = messageObject;

      const idType = WindowBidiTransport.#getJsonType(id);
      if (idType !== 'number' || !Number.isInteger(id) || id < 0) {
        // TODO: should uint64_t be the upper limit?
        // https://tools.ietf.org/html/rfc7049#section-2.1
        throw new Error(`Expected unsigned integer but got ${idType}`);
      }

      const methodType = WindowBidiTransport.#getJsonType(method);
      if (methodType !== 'string') {
        throw new Error(`Expected string method but got ${methodType}`);
      }

      const paramsType = WindowBidiTransport.#getJsonType(params);
      if (paramsType !== 'object') {
        throw new Error(`Expected object params but got ${paramsType}`);
      }

      let channel = messageObject.channel;
      if (channel !== undefined) {
        const channelType = WindowBidiTransport.#getJsonType(channel);
        if (channelType !== 'string') {
          throw new Error(`Expected string channel but got ${channelType}`);
        }
        // Empty string channel is considered as no channel provided.
        if (channel === '') {
          channel = undefined;
        }
      }

      return {id, method, params, channel};
    }
  }

  return BidiServer.createAndStart(
    new WindowBidiTransport(),
    createCdpConnection(),
    selfTargetId,
    new BidiParserImpl(),
    logger.log
  );
}

class BidiParserImpl implements BidiParser {
  parseGetRealmsParams(params: object): Script.GetRealmsParameters {
    return Parser.Script.parseGetRealmsParams(params);
  }

  parseCallFunctionParams(params: object): Script.CallFunctionParameters {
    return Parser.Script.parseCallFunctionParams(params);
  }

  parseEvaluateParams(params: object): Script.EvaluateParameters {
    return Parser.Script.parseEvaluateParams(params);
  }

  parseDisownParams(params: object): Script.DisownParameters {
    return Parser.Script.parseDisownParams(params);
  }

  parseSendCommandParams(params: object): CDP.SendCommandParams {
    return Parser.CDP.parseSendCommandParams(params) as CDP.SendCommandParams;
  }

  parseGetSessionParams(params: object): CDP.GetSessionParams {
    return Parser.CDP.parseGetSessionParams(params);
  }

  parseSubscribeParams(params: object): Session.SubscribeParameters {
    return Parser.Session.parseSubscribeParams(params);
  }

  parseNavigateParams(params: object): BrowsingContext.NavigateParameters {
    return Parser.BrowsingContext.parseNavigateParams(params);
  }

  parseGetTreeParams(params: object): BrowsingContext.GetTreeParameters {
    return Parser.BrowsingContext.parseGetTreeParams(params);
  }

  parseCreateParams(params: object): BrowsingContext.CreateParameters {
    return Parser.BrowsingContext.parseCreateParams(params);
  }

  parseCloseParams(params: object): BrowsingContext.CloseParameters {
    return Parser.BrowsingContext.parseCloseParams(params);
  }

  parseCaptureScreenshotParams(
    params: object
  ): BrowsingContext.CaptureScreenshotParameters {
    return Parser.BrowsingContext.parseCaptureScreenshotParams(params);
  }

  parsePrintParams(params: object): BrowsingContext.PrintParameters {
    return Parser.BrowsingContext.parsePrintParams(params);
  }
}

// Needed to filter out info related to BiDi target.
async function waitSelfTargetId(): Promise<string> {
  return new Promise((resolve) => {
    window.setSelfTargetId = (targetId) => {
      logger.log(LogType.system, 'Current target ID:', targetId);
      resolve(targetId);
    };
  });
}
