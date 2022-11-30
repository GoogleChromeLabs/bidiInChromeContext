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

import {CDPClient} from '../../cdp';
import {CommonDataTypes, Log, Script} from '../protocol/bidiProtocolTypes';
import {getRemoteValuesText} from './logHelper';
import {Protocol} from 'devtools-protocol';
import {Realm} from '../script/realm';
import {IEventManager} from '../events/EventManager';

export class LogManager {
  readonly #cdpClient: CDPClient;
  readonly #cdpSessionId: string;
  readonly #eventManager: IEventManager;

  private constructor(
    cdpClient: CDPClient,
    cdpSessionId: string,
    eventManager: IEventManager
  ) {
    this.#cdpSessionId = cdpSessionId;
    this.#cdpClient = cdpClient;
    this.#eventManager = eventManager;
  }

  public static create(
    cdpClient: CDPClient,
    cdpSessionId: string,
    eventManager: IEventManager
  ) {
    const logManager = new LogManager(cdpClient, cdpSessionId, eventManager);

    logManager.#initialize();
    return logManager;
  }

  #initialize() {
    this.#initializeEventListeners();
  }

  #initializeEventListeners() {
    this.#initializeLogEntryAddedEventListener();
  }

  #initializeLogEntryAddedEventListener() {
    this.#cdpClient.on(
      'Runtime.consoleAPICalled',
      (params: Protocol.Runtime.ConsoleAPICalledEvent) => {
        // Try to find realm by `cdpSessionId` and `executionContextId`,
        // if provided.
        const realm: Realm | undefined = Realm.findRealm({
          cdpSessionId: this.#cdpSessionId,
          executionContextId: params.executionContextId,
        });
        const argsPromise: Promise<CommonDataTypes.RemoteValue[]> =
          realm === undefined
            ? Promise.resolve(params.args)
            : // Properly serialize arguments if possible.
              Promise.all(
                params.args.map(async (arg) => {
                  return realm.serializeCdpObject(arg, 'none');
                })
              );

        // No need in waiting for the result, just register the event promise.
        // noinspection JSIgnoredPromiseFromCall
        this.#eventManager.registerPromiseEvent(
          argsPromise.then(
            (args) =>
              new Log.LogEntryAddedEvent({
                level: LogManager.#getLogLevel(params.type),
                source: {
                  realm: realm?.realmId ?? 'UNKNOWN',
                  context: realm?.browsingContextId ?? 'UNKNOWN',
                },
                text: getRemoteValuesText(args, true),
                timestamp: Math.round(params.timestamp),
                stackTrace: LogManager.#getBidiStackTrace(params.stackTrace),
                type: 'console',
                // Console method is `warn`, not `warning`.
                method: params.type === 'warning' ? 'warn' : params.type,
                args,
              })
          ),
          realm?.browsingContextId ?? 'UNKNOWN',
          Log.LogEntryAddedEvent.method
        );
      }
    );

    this.#cdpClient.on(
      'Runtime.exceptionThrown',
      (params: Protocol.Runtime.ExceptionThrownEvent) => {
        // Try to find realm by `cdpSessionId` and `executionContextId`,
        // if provided.
        const realm: Realm | undefined = Realm.findRealm({
          cdpSessionId: this.#cdpSessionId,
          executionContextId: params.exceptionDetails.executionContextId,
        });

        // Try all the best to get the exception text.
        const textPromise = (async () => {
          if (!params.exceptionDetails.exception) {
            return params.exceptionDetails.text;
          }
          if (realm === undefined) {
            return JSON.stringify(params.exceptionDetails.exception);
          }
          return await realm.stringifyObject(params.exceptionDetails.exception);
        })();

        // No need in waiting for the result, just register the event promise.
        // noinspection JSIgnoredPromiseFromCall
        this.#eventManager.registerPromiseEvent(
          textPromise.then(
            (text) =>
              new Log.LogEntryAddedEvent({
                level: 'error',
                source: {
                  realm: realm?.realmId ?? 'UNKNOWN',
                  context: realm?.browsingContextId ?? 'UNKNOWN',
                },
                text,
                timestamp: Math.round(params.timestamp),
                stackTrace: LogManager.#getBidiStackTrace(
                  params.exceptionDetails.stackTrace
                ),
                type: 'javascript',
              })
          ),
          realm?.browsingContextId ?? 'UNKNOWN',
          Log.LogEntryAddedEvent.method
        );
      }
    );
  }

  static #getLogLevel(consoleApiType: string): Log.LogLevel {
    if (['assert', 'error'].includes(consoleApiType)) {
      return 'error';
    }
    if (['debug', 'trace'].includes(consoleApiType)) {
      return 'debug';
    }
    if (['warn', 'warning'].includes(consoleApiType)) {
      return 'warn';
    }
    return 'info';
  }

  // convert CDP StackTrace object to Bidi StackTrace object
  static #getBidiStackTrace(
    cdpStackTrace: Protocol.Runtime.StackTrace | undefined
  ): Script.StackTrace | undefined {
    const stackFrames = cdpStackTrace?.callFrames.map((callFrame) => {
      return {
        columnNumber: callFrame.columnNumber,
        functionName: callFrame.functionName,
        lineNumber: callFrame.lineNumber,
        url: callFrame.url,
      };
    });

    return stackFrames ? {callFrames: stackFrames} : undefined;
  }
}
