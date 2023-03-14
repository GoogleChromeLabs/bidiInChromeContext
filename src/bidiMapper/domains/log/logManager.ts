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
import {Protocol} from 'devtools-protocol';

import {CommonDataTypes, Log, Script} from '../../../protocol/protocol.js';
import {IEventManager} from '../events/EventManager.js';
import {Realm} from '../script/realm.js';
import {RealmStorage} from '../script/realmStorage.js';
import {CdpTarget} from '../context/cdpTarget';

import {getRemoteValuesText} from './logHelper.js';

/** Converts CDP StackTrace object to Bidi StackTrace object. */
function getBidiStackTrace(
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

function getLogLevel(consoleApiType: string): Log.LogLevel {
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

export class LogManager {
  readonly #eventManager: IEventManager;
  readonly #realmStorage: RealmStorage;
  readonly #cdpTarget: CdpTarget;

  private constructor(
    cdpTarget: CdpTarget,
    realmStorage: RealmStorage,
    eventManager: IEventManager
  ) {
    this.#cdpTarget = cdpTarget;
    this.#realmStorage = realmStorage;
    this.#eventManager = eventManager;
  }

  static create(
    cdpTarget: CdpTarget,
    realmStorage: RealmStorage,
    eventManager: IEventManager
  ) {
    const logManager = new LogManager(cdpTarget, realmStorage, eventManager);

    logManager.#initialize();
    return logManager;
  }

  #initialize() {
    this.#initializeLogEntryAddedEventListener();
  }

  #initializeLogEntryAddedEventListener() {
    this.#cdpTarget.cdpClient.on(
      'Runtime.consoleAPICalled',
      (params: Protocol.Runtime.ConsoleAPICalledEvent) => {
        // Try to find realm by `cdpSessionId` and `executionContextId`,
        // if provided.
        const realm: Realm | undefined = this.#realmStorage.findRealm({
          cdpSessionId: this.#cdpTarget.cdpSessionId,
          executionContextId: params.executionContextId,
        });
        const argsPromise: Promise<CommonDataTypes.RemoteValue[]> =
          realm === undefined
            ? Promise.resolve(params.args as CommonDataTypes.RemoteValue[])
            : // Properly serialize arguments if possible.
              Promise.all(
                params.args.map((arg) => {
                  return realm.serializeCdpObject(arg, 'none');
                })
              );

        // No need in awaiting for the result, just register the event promise.
        this.#eventManager.registerPromiseEvent(
          argsPromise.then((args) => ({
            method: Log.EventNames.LogEntryAddedEvent,
            params: {
              level: getLogLevel(params.type),
              source: {
                realm: realm?.realmId ?? 'UNKNOWN',
                context: realm?.browsingContextId ?? 'UNKNOWN',
              },
              text: getRemoteValuesText(args, true),
              timestamp: Math.round(params.timestamp),
              stackTrace: getBidiStackTrace(params.stackTrace),
              type: 'console',
              // Console method is `warn`, not `warning`.
              method: params.type === 'warning' ? 'warn' : params.type,
              args,
            },
          })),
          realm?.browsingContextId ?? 'UNKNOWN',
          Log.EventNames.LogEntryAddedEvent
        );
      }
    );

    this.#cdpTarget.cdpClient.on(
      'Runtime.exceptionThrown',
      (params: Protocol.Runtime.ExceptionThrownEvent) => {
        // Try to find realm by `cdpSessionId` and `executionContextId`,
        // if provided.
        const realm: Realm | undefined = this.#realmStorage.findRealm({
          cdpSessionId: this.#cdpTarget.cdpSessionId,
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
          return realm.stringifyObject(params.exceptionDetails.exception);
        })();

        // No need in awaiting for the result, just register the event promise.
        this.#eventManager.registerPromiseEvent(
          textPromise.then((text) => ({
            method: Log.EventNames.LogEntryAddedEvent,
            params: {
              level: 'error',
              source: {
                realm: realm?.realmId ?? 'UNKNOWN',
                context: realm?.browsingContextId ?? 'UNKNOWN',
              },
              text,
              timestamp: Math.round(params.timestamp),
              stackTrace: getBidiStackTrace(params.exceptionDetails.stackTrace),
              type: 'javascript',
            },
          })),
          realm?.browsingContextId ?? 'UNKNOWN',
          Log.EventNames.LogEntryAddedEvent
        );
      }
    );
  }
}
