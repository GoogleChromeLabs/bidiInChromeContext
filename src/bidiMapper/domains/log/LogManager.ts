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
import type {Protocol} from 'devtools-protocol';

import {ChromiumBidi, Log, Script} from '../../../protocol/protocol.js';
import type {EventManager} from '../events/EventManager.js';
import type {Realm} from '../script/Realm.js';
import type {RealmStorage} from '../script/RealmStorage.js';
import type {CdpTarget} from '../context/CdpTarget.js';

import {getRemoteValuesText} from './logHelper.js';

/** Converts CDP StackTrace object to BiDi StackTrace object. */
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

function getLogLevel(consoleApiType: string): Log.Level {
  if ([Log.Level.Error, 'assert'].includes(consoleApiType)) {
    return Log.Level.Error;
  }
  if ([Log.Level.Debug, 'trace'].includes(consoleApiType)) {
    return Log.Level.Debug;
  }
  if ([Log.Level.Warn, 'warning'].includes(consoleApiType)) {
    return Log.Level.Warn;
  }
  return Log.Level.Info;
}

export class LogManager {
  readonly #eventManager: EventManager;
  readonly #realmStorage: RealmStorage;
  readonly #cdpTarget: CdpTarget;

  private constructor(
    cdpTarget: CdpTarget,
    realmStorage: RealmStorage,
    eventManager: EventManager
  ) {
    this.#cdpTarget = cdpTarget;
    this.#realmStorage = realmStorage;
    this.#eventManager = eventManager;
  }

  static create(
    cdpTarget: CdpTarget,
    realmStorage: RealmStorage,
    eventManager: EventManager
  ) {
    const logManager = new LogManager(cdpTarget, realmStorage, eventManager);

    logManager.#initializeEntryAddedEventListener();

    return logManager;
  }

  #initializeEntryAddedEventListener() {
    this.#cdpTarget.cdpClient.on(
      'Runtime.consoleAPICalled',
      (params: Protocol.Runtime.ConsoleAPICalledEvent) => {
        // Try to find realm by `cdpSessionId` and `executionContextId`,
        // if provided.
        const realm: Realm | undefined = this.#realmStorage.findRealm({
          cdpSessionId: this.#cdpTarget.cdpSessionId,
          executionContextId: params.executionContextId,
        });
        const argsPromise: Promise<Script.RemoteValue[]> =
          realm === undefined
            ? Promise.resolve(params.args as Script.RemoteValue[])
            : // Properly serialize arguments if possible.
              Promise.all(
                params.args.map((arg) => {
                  return realm.serializeCdpObject(
                    arg,
                    Script.ResultOwnership.None
                  );
                })
              );

        this.#eventManager.registerPromiseEvent(
          argsPromise.then((args) => ({
            kind: 'success',
            value: {
              type: 'event',
              method: ChromiumBidi.Log.EventNames.LogEntryAdded,
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
            },
          })),
          realm?.browsingContextId ?? 'UNKNOWN',
          ChromiumBidi.Log.EventNames.LogEntryAdded
        );
      }
    );

    this.#cdpTarget.cdpClient.on(
      'Runtime.exceptionThrown',
      (params: Protocol.Runtime.ExceptionThrownEvent) => {
        // Try to find realm by `cdpSessionId` and `executionContextId`,
        // if provided.
        const realm = this.#realmStorage.findRealm({
          cdpSessionId: this.#cdpTarget.cdpSessionId,
          executionContextId: params.exceptionDetails.executionContextId,
        });

        this.#eventManager.registerPromiseEvent(
          LogManager.#getExceptionText(params, realm).then((text) => ({
            kind: 'success',
            value: {
              type: 'event',
              method: ChromiumBidi.Log.EventNames.LogEntryAdded,
              params: {
                level: Log.Level.Error,
                source: {
                  realm: realm?.realmId ?? 'UNKNOWN',
                  context: realm?.browsingContextId ?? 'UNKNOWN',
                },
                text,
                timestamp: Math.round(params.timestamp),
                stackTrace: getBidiStackTrace(
                  params.exceptionDetails.stackTrace
                ),
                type: 'javascript',
              },
            },
          })),
          realm?.browsingContextId ?? 'UNKNOWN',
          ChromiumBidi.Log.EventNames.LogEntryAdded
        );
      }
    );
  }

  /**
   * Try the best to get the exception text.
   */
  static async #getExceptionText(
    params: Protocol.Runtime.ExceptionThrownEvent,
    realm?: Realm
  ): Promise<string> {
    if (!params.exceptionDetails.exception) {
      return params.exceptionDetails.text;
    }
    if (realm === undefined) {
      return JSON.stringify(params.exceptionDetails.exception);
    }
    return realm.stringifyObject(params.exceptionDetails.exception);
  }
}
