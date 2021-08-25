import { IServer } from '../utils/iServer';
import { CdpMessage } from './message';
import { CdpClient, createClient } from './cdpClient';

import { log } from '../utils/log';
const logCdp = log('cdp');

interface CdpCallbacks {
  resolve: (messageObj: {}) => void;
  reject: (errorObj: {}) => void;
}

/**
 * Represents a high-level CDP connection to the browser backend.
 * Manages a CdpClient instance for each active CDP session.
 */
export class Connection {
  private _browserClient: CdpClient;
  private _clients: Map<string, CdpClient> = new Map();
  private _commandCallbacks: Map<number, CdpCallbacks> = new Map();
  private _nextId: number;

  constructor(private _transport: IServer) {
    this._nextId = 0;
    this._transport.setOnMessage(this._onMessage);
    this._browserClient = createClient(this, null);
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
    this._clients.clear();
  }

  /**
   * @returns The CdpClient object attached to the root browser session.
   */
  browserClient(): CdpClient {
    return this._browserClient;
  }

  /**
   * Get a CdpClient instance by sessionId.
   * @param sessionId The sessionId of the CdpClient to retrieve.
   * @returns The CdpClient object attached to the given session, or null if the session is not attached.
   */
  sessionClient(sessionId: string): CdpClient | null {
    return this._clients.get(sessionId) || null;
  }

  /**
   * @internal
   */
  _sendCommand(
    method: string,
    params: {},
    sessionId: string | null
  ): Promise<{}> {
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
      this._clients.set(sessionId, createClient(this, sessionId));
    } else if (parsed.method === 'Target.detachedFromTarget') {
      const { sessionId } = parsed.params;
      const client = this._clients.get(sessionId);
      if (client) {
        this._clients.delete(sessionId);
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
        ? this._clients.get(parsed.sessionId)
        : this._browserClient;
      if (client) {
        client._onCdpEvent(parsed.method, parsed.params || {});
      }
    }
  };
}
