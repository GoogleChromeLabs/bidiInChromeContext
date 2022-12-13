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

import websocket from 'websocket';
import http from 'http';
import {ITransport} from '../utils/transport.js';

import debug from 'debug';

const debugInternal = debug('bidiServer:internal');
const debugSend = debug('bidiServer:SEND ►');
const debugRecv = debug('bidiServer:RECV ◀');

export class BidiServerRunner {
  /**
   *
   * @param bidiPort port to start ws server on
   * @param onNewBidiConnectionOpen delegate to be called for each new
   * connection. `onNewBidiConnectionOpen` delegate should return another
   * `onConnectionClose` delegate, which will be called after the connection is
   * closed.
   */
  static run(
    bidiPort: number,
    onNewBidiConnectionOpen: (bidiServer: ITransport) => Promise<() => void>
  ) {
    const self = this;

    const server = http.createServer(async function (
      request: http.IncomingMessage,
      response: http.ServerResponse
    ) {
      debugInternal(
        `${new Date()} Received ${request.method} request for ${request.url}`
      );
      if (!request.url) return response.end(404);

      // https://w3c.github.io/webdriver-bidi/#transport, step 2.
      if (request.url === '/session') {
        response.writeHead(200, {
          'Content-Type': 'application/json;charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        response.write(
          JSON.stringify({
            value: {
              sessionId: '1',
              capabilities: {
                webSocketUrl: 'ws://localhost:' + bidiPort,
              },
            },
          })
        );
      } else if (request.url.startsWith('/session')) {
        debugInternal(
          `Unknown session command ${JSON.stringify(
            request.method
          )} request for ${JSON.stringify(
            request.url
          )} with payload ${JSON.stringify(
            await BidiServerRunner.#getHttpRequestPayload(request)
          )}. 200 returned.`
        );

        response.writeHead(200, {
          'Content-Type': 'application/json;charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        response.write(
          JSON.stringify({
            value: {},
          })
        );
      } else {
        debugInternal(
          `Unknown ${JSON.stringify(
            request.method
          )} request for ${JSON.stringify(
            request.url
          )} with payload ${JSON.stringify(
            await BidiServerRunner.#getHttpRequestPayload(request)
          )}. 404 returned.`
        );
        response.writeHead(404);
      }
      response.end();
    });
    server.listen(bidiPort, function () {
      console.log(`Server is listening on port ${bidiPort}`);
    });

    const wsServer: websocket.server = new websocket.server({
      httpServer: server,
      autoAcceptConnections: false,
    });

    wsServer.on('request', async function (request: websocket.request) {
      debugInternal(
        `new WS request received: ${JSON.stringify(request.resourceURL.path)}`
      );

      const bidiServer = new BidiServer();

      const onBidiConnectionClosed = await onNewBidiConnectionOpen(bidiServer);

      const connection = request.accept();

      connection.on('message', function (message) {
        // 1. If |type| is not text, return.
        if (message.type !== 'utf8') {
          self.#respondWithError(
            connection,
            {},
            'invalid argument',
            `not supported type (${message.type})`
          );
          return;
        }

        const plainCommandData = message.utf8Data;

        debugRecv(plainCommandData);
        bidiServer.onMessage(plainCommandData);
      });

      connection.on('close', function () {
        debugInternal(
          new Date() + ' Peer ' + connection.remoteAddress + ' disconnected.'
        );

        onBidiConnectionClosed();
      });

      bidiServer.initialise((messageStr) => {
        return self.#sendClientMessageStr(messageStr, connection);
      });
    });
  }

  static async #getHttpRequestPayload(
    request: http.IncomingMessage
  ): Promise<string> {
    return new Promise((resolve) => {
      let data = '';
      request.on('data', (chunk) => {
        data += chunk;
      });
      request.on('end', () => {
        resolve(data);
      });
    });
  }

  static #sendClientMessageStr(
    messageStr: string,
    connection: websocket.connection
  ): Promise<void> {
    debugSend(messageStr);
    connection.sendUTF(messageStr);
    return Promise.resolve();
  }

  static #sendClientMessage(
    messageObj: any,
    connection: websocket.connection
  ): Promise<void> {
    const messageStr = JSON.stringify(messageObj);
    return this.#sendClientMessageStr(messageStr, connection);
  }

  static #respondWithError(
    connection: websocket.connection,
    plainCommandData: any,
    errorCode: string,
    errorMessage: string
  ) {
    const errorResponse = this.#getErrorResponse(
      plainCommandData,
      errorCode,
      errorMessage
    );
    this.#sendClientMessage(errorResponse, connection);
  }

  static #getErrorResponse(
    plainCommandData: any,
    errorCode: string,
    errorMessage: string
  ): any {
    // TODO: this is bizarre per spec. We reparse the payload and
    // extract the ID, regardless of what kind of value it was.
    let commandId = undefined;
    try {
      const commandData = JSON.parse(plainCommandData);
      if ('id' in commandData) {
        commandId = commandData.id;
      }
    } catch {}

    return {
      id: commandId,
      error: errorCode,
      message: errorMessage,
      // TODO: optional stacktrace field.
    };
  }
}

class BidiServer implements ITransport {
  #handlers: ((messageStr: string) => void)[] = [];
  #sendBidiMessage: ((messageStr: string) => Promise<void>) | null = null;

  setOnMessage(handler: (messageStr: string) => Promise<void>): void {
    this.#handlers.push(handler);
  }

  sendMessage(messageStr: any): Promise<void> {
    if (!this.#sendBidiMessage)
      throw new Error('Bidi connection is not initialised yet');

    return this.#sendBidiMessage(messageStr);
  }

  close() {}

  initialise(sendBidiMessage: (messageStr: string) => Promise<void>): void {
    this.#sendBidiMessage = sendBidiMessage;
  }

  onMessage(messageStr: string): void {
    for (let handler of this.#handlers) handler(messageStr);
  }
}
