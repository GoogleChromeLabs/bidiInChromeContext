/*
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
 *
 */

import {CommonDataTypes, Script} from '../../../protocol/protocol.js';
import {Realm} from './realm.js';
import {IEventManager} from '../events/EventManager.js';
import Handle = CommonDataTypes.Handle;

export class ChannelProxy {
  readonly #channel: Script.ChannelProperties;
  readonly #eventManager: IEventManager;
  readonly #realm: Realm;
  readonly #channelHandle: CommonDataTypes.Handle;
  readonly #sendMessageHandle: CommonDataTypes.Handle;

  constructor(
    channel: Script.ChannelProperties,
    eventManager: IEventManager,
    realm: Realm,
    channelHandle: CommonDataTypes.Handle,
    sendMessageHandle: CommonDataTypes.Handle
  ) {
    this.#channel = channel;
    this.#eventManager = eventManager;
    this.#realm = realm;
    this.#channelHandle = channelHandle;
    this.#sendMessageHandle = sendMessageHandle;
  }

  static async init(
    channel: Script.ChannelProperties,
    eventManager: IEventManager,
    realm: Realm
  ): Promise<ChannelProxy> {
    const channelHandle = await ChannelProxy.#createHandle(realm);
    const sendMessageHandle = await ChannelProxy.#createSendMessageHandle(
      realm,
      channelHandle
    );

    const channelProxy = new ChannelProxy(
      channel,
      eventManager,
      realm,
      channelHandle,
      sendMessageHandle
    );

    void channelProxy.initChannelListener();
    return channelProxy;
  }

  static async #createHandle(realm: Realm): Promise<CommonDataTypes.Handle> {
    const createChannelHandleResult = await realm.cdpClient.sendCommand(
      'Runtime.callFunctionOn',
      {
        functionDeclaration: String(() => {
          const queue: unknown[] = [];
          let queueNonEmptyResolver: null | (() => void) = null;

          return {
            /**
             * Gets a promise, which is resolved as soon as a message occurs
             * in the queue.
             */
            async getMessage(): Promise<unknown> {
              const onMessage =
                queue.length > 0
                  ? Promise.resolve()
                  : new Promise<void>((resolve) => {
                      queueNonEmptyResolver = resolve;
                    });
              await onMessage;
              return queue.shift();
            },

            /**
             * Adds a message to the queue.
             * Resolves the pending promise if needed.
             */
            sendMessage(message: string) {
              queue.push(message);
              if (queueNonEmptyResolver !== null) {
                queueNonEmptyResolver();
                queueNonEmptyResolver = null;
              }
            },
          };
        }),
        executionContextId: realm.executionContextId,
        serializationOptions: {
          serialization: 'idOnly',
        },
      }
    );
    if (createChannelHandleResult.exceptionDetails) {
      throw new Error(
        `Failed to create channel handle: ${createChannelHandleResult.exceptionDetails}`
      );
    }
    return createChannelHandleResult.result.objectId!;
  }

  static async #createSendMessageHandle(
    realm: Realm,
    channelHandle: CommonDataTypes.Handle
  ): Promise<Handle> {
    const sendMessageArgResult = await realm.cdpClient.sendCommand(
      'Runtime.callFunctionOn',
      {
        functionDeclaration: String(
          (channelHandle: {sendMessage: (message: string) => void}) => {
            return channelHandle.sendMessage;
          }
        ),
        arguments: [{objectId: channelHandle}],
        executionContextId: realm.executionContextId,
        serializationOptions: {
          serialization: 'deep',
        },
      }
    );
    return sendMessageArgResult.result.objectId!;
  }

  get sendMessageHandle(): CommonDataTypes.Handle {
    return this.#sendMessageHandle;
  }

  async initChannelListener() {
    // TODO(#294): Remove this loop after the realm is destroyed.
    // Rely on the CDP throwing exception in such a case.
    // noinspection InfiniteLoopJS
    for (;;) {
      const message = await this.#realm.cdpClient.sendCommand(
        'Runtime.callFunctionOn',
        {
          functionDeclaration: String(
            async (channelHandle: {getMessage: () => Promise<unknown>}) =>
              channelHandle.getMessage()
          ),
          arguments: [
            {
              objectId: this.#channelHandle,
            },
          ],
          awaitPromise: true,
          executionContextId: this.#realm.executionContextId,
          serializationOptions: {
            serialization: 'deep',
          },
        }
      );

      this.#eventManager.registerEvent(
        {
          method: Script.EventNames.MessageEvent,
          params: {
            channel: this.#channel.channel,
            data: this.#realm.cdpToBidiValue(
              message,
              this.#channel.ownership ?? 'none'
            ),
            source: {
              realm: this.#realm.realmId,
              context: this.#realm.browsingContextId,
            },
          },
        },
        this.#realm.browsingContextId
      );
    }
  }
}
