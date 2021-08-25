/**
 * Copyright 2021 Google Inc. All rights reserved.
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
import debug from 'debug';

const debugInternal = debug('bidiMapper:internal');
const debugLog = debug('bidiMapper:log');

import WebSocket from 'ws';
import Protocol from 'devtools-protocol';

import { IServer } from './utils/iServer';
import { CdpClient, Connection, WebSocketTransport } from './cdp';

export class MapperServer implements IServer {
  private _handlers: ((messageObj: any) => void)[] = new Array();

  static async create(
    cdpUrl: string,
    mapperContent: string
  ): Promise<MapperServer> {
    const cdpConnection = await this._establishCdpConnection(cdpUrl);
    try {
      const mapperCdpClient = await this._initMapper(
        cdpConnection,
        mapperContent
      );
      return new MapperServer(cdpConnection, mapperCdpClient);
    } catch (e) {
      browserCdpClient.close();
    }
  }

  private constructor(private _cdpConnection: Connection, private _mapperCdpClient: CdpClient) {
    this._mapperCdpClient.Runtime.on('bindingCalled', this._onBindingCalled);
    this._mapperCdpClient.Runtime.on(
      'consoleAPICalled',
      this._onConsoleAPICalled
    );
  }

  setOnMessage(handler: (messageObj: any) => void): void {
    this._handlers.push(handler);
  }
  sendMessage(messageObj: string): Promise<void> {
    return this._sendBidiMessage(messageObj);
  }
  close() {
    this._cdpConnection.close();
  }

  private static async _establishCdpConnection(
    cdpUrl: string
  ): Promise<Connection> {

    return new Promise((resolve, reject) => {
      debugInternal('Establishing session with cdpUrl: ', cdpUrl);

      const ws = new WebSocket(cdpUrl);

      ws.once('error', reject);

      ws.on('open', () => {
        debugInternal('Session established.');

        const transport = new WebSocketTransport(ws);
        const connection = new Connection(transport);
        resolve(connection);
      });
    });
  }

  private async _sendBidiMessage(bidiMessageObj: any): Promise<void> {
    await this._mapperCdpClient.Runtime.evaluate({
      expression: 'onBidiMessage(' + JSON.stringify(bidiMessageObj) + ')',
    });
  }

  private _onBidiMessage(bidiMessageObj: any): void {
    for (let handler of this._handlers) handler(bidiMessageObj);
  }

  private _onBindingCalled = async (
    params: Protocol.Runtime.BindingCalledEvent
  ) => {
    if (params.name === 'sendBidiResponse') {
      this._onBidiMessage(params.payload);
    }
  };

  private _onConsoleAPICalled = async (
    params: Protocol.Runtime.ConsoleAPICalledEvent
  ) => {
    debugLog(
      'consoleAPICalled %s %O',
      params.type,
      params.args.map((arg) => arg.value)
    );
  };

  private static async _initMapper(
    cdpConnection: Connection,
    mapperContent: string
  ): Promise<CdpClient> {
    debugInternal('Connection opened.');

    // await browserClient.Log.enable();

    const browserClient = cdpConnection.browserClient();

    const { targetId } = await browserClient.Target.createTarget({
      url: 'about:blank',
    });
    const { sessionId: mapperSessionId } =
      await browserClient.Target.attachToTarget({ targetId, flatten: true });

    const mapperCdpClient = cdpConnection.sessionClient(mapperSessionId);

    await mapperCdpClient.Runtime.enable();

    await browserClient.Target.exposeDevToolsProtocol({
      bindingName: 'cdp',
      targetId,
    });

    await mapperCdpClient.Runtime.addBinding({
      name: 'sendBidiResponse',
    });

    const launchedPromise = new Promise<void>((resolve) => {
      const onBindingCalled = ({
        name,
        payload,
      }: Protocol.Runtime.BindingCalledEvent) => {
        // Needed to check when Mapper is launched on the frontend.
        if (name === 'sendBidiResponse' && payload === '"launched"') {
          mapperCdpClient.Runtime.removeListener(
            'bindingCalled',
            onBindingCalled
          );
          resolve();
        }
      };

      mapperCdpClient.Runtime.on('bindingCalled', onBindingCalled);
    });

    await mapperCdpClient.Runtime.evaluate({ expression: mapperContent });

    // Let Mapper know what is it's TargetId to filter out related targets.
    await mapperCdpClient.Runtime.evaluate({
      expression: 'window.setSelfTargetId(' + JSON.stringify(targetId) + ')',
    });

    await launchedPromise;
    debugInternal('Launched!');
    return mapperCdpClient;
  }
}
