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

import { ITransport } from '../utils/transport';
import { CdpMessage } from './cdpMessage';
import { CdpClient, createClient } from './cdpClient';

import { log } from '../utils/log';
const logCdp = log('CDP');

interface CdpCallbacks {
  resolve: (messageObj: object) => void;
  reject: (errorObj: object) => void;
}

/**
 * Represents a high-level CDP connection to the browser backend.
 * Manages a CdpClient instance for each active CDP session.
 */
export class CdpConnection {
  private _browserCdpClient: CdpClient;
  private _sessionCdpClients: Map<string, CdpClient> = new Map();
  private _commandCallbacks: Map<number, CdpCallbacks> = new Map();
  private _nextId: number;

  constructor(private _transport: ITransport) {
    this._nextId = 0;
    this._transport.setOnMessage(this._onMessage);
    this._browserCdpClient = createClient(this, null);
  }

  /**
   * Close the connection to the browser.
   */
  close() {
    this._transport.close();
    for (const [_id, { reject }] of this._commandCallbacks) {
      reject(new Error('Disconnected'));
    }
    this._commandCallbacks.clear();
    this._sessionCdpClients.clear();
  }

  /**
   * @returns The CdpClient object attached to the root browser session.
   */
  browserClient(): CdpClient {
    return this._browserCdpClient;
  }

  /**
   * Get a CdpClient instance by sessionId.
   * @param sessionId The sessionId of the CdpClient to retrieve.
   * @returns The CdpClient object attached to the given session, or null if the session is not attached.
   */
  getCdpClient(sessionId: string): CdpClient {
    const cdpClient = this._sessionCdpClients.get(sessionId);
    if (!cdpClient) {
      throw new Error('Unknown CDP session ID');
    }
    return cdpClient;
  }

  sendCommand(
    method: string,
    params: object,
    sessionId: string | null
  ): Promise<object> {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      this._commandCallbacks.set(id, { resolve, reject });
      let messageObj: CdpMessage = { id, method, params };
      if (sessionId) {
        messageObj.sessionId = sessionId;
      }

      const messageStr = JSON.stringify(messageObj);
      this._transport.sendMessage(messageStr);
      logCdp('sent > ' + messageStr);
    });
  }

  private _onMessage = async (message: string) => {
    logCdp('received < ' + message);

    const parsed = JSON.parse(message);

    // Update client map if a session is attached or detached.
    // Listen for these events on every session.
    if (parsed.method === 'Target.attachedToTarget') {
      const { sessionId } = parsed.params;
      this._sessionCdpClients.set(sessionId, createClient(this, sessionId));
    } else if (parsed.method === 'Target.detachedFromTarget') {
      const { sessionId } = parsed.params;
      const client = this._sessionCdpClients.get(sessionId);
      if (client) {
        this._sessionCdpClients.delete(sessionId);
      }
    }

    if (parsed.id !== undefined) {
      // Handle command response.
      const callbacks = this._commandCallbacks.get(parsed.id);
      if (callbacks) {
        if (parsed.result) {
          callbacks.resolve(parsed.result);
        } else if (parsed.error) {
          callbacks.reject(parsed.error);
        }
      }
    } else if (parsed.method) {
      const client = parsed.sessionId
        ? this._sessionCdpClients.get(parsed.sessionId)
        : this._browserCdpClient;
      if (client) {
        client._onCdpEvent(parsed.method, parsed.params || {});
      }
    }
  };
}
