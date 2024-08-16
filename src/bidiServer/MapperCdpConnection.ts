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

import debug, {type Debugger} from 'debug';
import type {Protocol} from 'devtools-protocol';

import type {MapperCdpClient} from '../cdp/CdpClient.js';
import type {MapperCdpConnection} from '../cdp/CdpConnection.js';
import type {LogPrefix, LogType} from '../utils/log.js';

import {SimpleTransport} from './SimpleTransport.js';

const debugInternal = debug('bidi:mapper:internal');
const debugInfo = debug('bidi:mapper:info');
const debugOthers = debug('bidi:mapper:debug:others');
// Memorizes a debug creation
const loggers = new Map<string, Debugger>();
const getLogger = (type: LogPrefix) => {
  const prefix = `bidi:mapper:${type}`;
  let logger = loggers.get(prefix);
  if (!logger) {
    logger = debug(prefix);
    loggers.set(prefix, logger);
  }
  return logger;
};
const MAX_SW_TARGET_RETRIES = 3;
const RETRY_TIMEOUT_MS = 25;

export class MapperServerCdpConnection {
  #cdpConnection: MapperCdpConnection;
  #bidiSession: SimpleTransport;

  static async create(
    cdpConnection: MapperCdpConnection,
    mapperTabSource: string,
    verbose: boolean
  ): Promise<MapperServerCdpConnection> {
    try {
      const bidiSession = await this.#initMapper(
        cdpConnection,
        mapperTabSource,
        verbose
      );
      return new MapperServerCdpConnection(cdpConnection, bidiSession);
    } catch (e) {
      cdpConnection.close();
      throw e;
    }
  }

  private constructor(
    cdpConnection: MapperCdpConnection,
    bidiSession: SimpleTransport
  ) {
    this.#cdpConnection = cdpConnection;
    this.#bidiSession = bidiSession;
  }

  static async #sendMessage(
    mapperCdpClient: MapperCdpClient,
    message: string
  ): Promise<void> {
    try {
      await mapperCdpClient.sendCommand('Runtime.evaluate', {
        expression: `onBidiMessage(${JSON.stringify(message)})`,
      });
    } catch (error) {
      debugInternal('Call to onBidiMessage failed', error);
    }
  }

  close() {
    this.#cdpConnection.close();
  }

  bidiSession(): SimpleTransport {
    return this.#bidiSession;
  }

  static #onBindingCalled = (
    params: Protocol.Runtime.BindingCalledEvent,
    bidiSession: SimpleTransport
  ) => {
    if (params.name === 'sendBidiResponse') {
      bidiSession.emit('message', params.payload);
    } else if (params.name === 'sendDebugMessage') {
      this.#onDebugMessage(params.payload);
    }
  };

  static #onDebugMessage = (json: string) => {
    try {
      const log: {
        logType?: LogType;
        messages?: unknown[];
      } = JSON.parse(json);

      if (log.logType !== undefined && log.messages !== undefined) {
        const logger = getLogger(log.logType);
        logger(log.messages);
      }
    } catch {
      // Fall back to raw log in case of unknown
      debugOthers(json);
    }
  };

  static #onConsoleAPICalled = (
    params: Protocol.Runtime.ConsoleAPICalledEvent
  ) => {
    debugInfo(
      'consoleAPICalled: %s %O',
      params.type,
      params.args.map((arg) => arg.value)
    );
  };

  static #onRuntimeExceptionThrown = (
    params: Protocol.Runtime.ExceptionThrownEvent
  ) => {
    debugInfo('exceptionThrown:', params);
  };

  static async #initMapper(
    cdpConnection: MapperCdpConnection,
    mapperTabSource: string,
    verbose: boolean
  ): Promise<SimpleTransport> {
    debugInternal('Initializing Mapper.');

    const browserClient = await cdpConnection.createBrowserSession();
    
    let mapperWorkerTargetId: string | null = null;
      
    // Command extension to open an offscreen page.
    for (let i = 0; i < MAX_SW_TARGET_RETRIES; i++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_TIMEOUT_MS));
      let targets = (await cdpConnection.sendCommand(
        'Target.getTargets',
        {}
      )) as Protocol.Target.GetTargetsResponse;
      const mapperWorkerTarget = targets.targetInfos.filter(
        (target) => target.type === 'service_worker'
      )[0];
      if (mapperWorkerTarget !== undefined) {
        mapperWorkerTargetId = mapperWorkerTarget.targetId;
        break;
      }
    }

    if (mapperWorkerTargetId === null) {
      throw new Error("Mapper extension did not start");
    }

    const {sessionId: mapperWorkerSessionId} = await browserClient.sendCommand(
      'Target.attachToTarget',
      {targetId: mapperWorkerTargetId, flatten: true}
    );
    const mapperWorkerCdpClient = cdpConnection.getCdpClient(mapperWorkerSessionId);
    // `chrome.offscreen` is not immidiately available in the SW context. Evaluate a dummy expression to
    // wait for it.
    // TODO: Find a better way to wait for when `chrome.offscreen` becomes available.
    await mapperWorkerCdpClient.sendCommand('Runtime.evaluate', {
      expression: 
        "console.log(chrome.offscreen)",
    });
    const res = await mapperWorkerCdpClient.sendCommand('Runtime.evaluate', {
      expression: 
        "chrome.offscreen.createDocument({" +
            "url: chrome.runtime.getURL('hello.html')," +
            "reasons: ['CLIPBOARD']," +
            "justification: 'a context to load the mapper script to'," +
        "})",
      awaitPromise: true,
      userGesture: true,
    });
    // Run mapper in the opened offscreen page.
    const targets = (await cdpConnection.sendCommand(
      'Target.getTargets',
      {}
    )) as Protocol.Target.GetTargetsResponse;
    const mapperTabTargetId = targets.targetInfos.filter(
      (target) => target.type === 'page' && target.url.startsWith("chrome-extension://")
    )[0]!.targetId;

    const {sessionId: mapperSessionId} = await browserClient.sendCommand(
      'Target.attachToTarget',
      {targetId: mapperTabTargetId, flatten: true}
    );
   
    const mapperCdpClient = cdpConnection.getCdpClient(mapperSessionId);

    const bidiSession = new SimpleTransport(
      async (message) => await this.#sendMessage(mapperCdpClient, message)
    );

    // Process responses from the mapper page.
    mapperCdpClient.on('Runtime.bindingCalled', (params) =>
      this.#onBindingCalled(params, bidiSession)
    );
    // Forward console messages from the mapper page.
    mapperCdpClient.on('Runtime.consoleAPICalled', this.#onConsoleAPICalled);
    // Catch unhandled exceptions in the mapper.
    mapperCdpClient.on(
      'Runtime.exceptionThrown',
      this.#onRuntimeExceptionThrown
    );

    await mapperCdpClient.sendCommand('Runtime.enable');

    await browserClient.sendCommand('Target.exposeDevToolsProtocol', {
      bindingName: 'cdp',
      targetId: mapperTabTargetId,
    });

    await mapperCdpClient.sendCommand('Runtime.addBinding', {
      name: 'sendBidiResponse',
    });

    if (verbose) {
      // Needed to request verbose logs from Mapper.
      await mapperCdpClient.sendCommand('Runtime.addBinding', {
        name: 'sendDebugMessage',
      });
    }

    // Evaluate Mapper sources on the offscreen page.
    await mapperCdpClient.sendCommand('Runtime.evaluate', {
      expression: mapperTabSource,
    });

    // TODO: handle errors in all these evaluate calls!
    await mapperCdpClient.sendCommand('Runtime.evaluate', {
      expression: `window.runMapperInstance('${mapperTabTargetId}')`,
      awaitPromise: true,
    });

    debugInternal('Mapper is launched!');
    return bidiSession;
  }
}
