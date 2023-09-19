/**
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
 */
import type Protocol from 'devtools-protocol';

import {URLPattern} from '../../../utils/UrlPattern.js';
import {uuidv4} from '../../../utils/uuid.js';
import {
  Network,
  NoSuchInterceptException,
  ChromiumBidi,
  NoSuchRequestException,
} from '../../../protocol/protocol.js';
import type {EventManager} from '../events/EventManager.js';

import {NetworkRequest} from './NetworkRequest.js';

/** Stores network and intercept maps. */
export class NetworkStorage {
  #eventManager: EventManager;
  /**
   * A map from network request ID to Network Request objects.
   * Needed as long as information about requests comes from different events.
   */
  readonly #requestMap = new Map<Network.Request, NetworkRequest>();

  /** A map from intercept ID to track active network intercepts. */
  readonly #interceptMap = new Map<
    Network.Intercept,
    {
      urlPatterns: Network.UrlPattern[];
      phases: Network.InterceptPhase[];
    }
  >();

  /** A map from network request ID to track actively blocked requests. */
  readonly #blockedRequestMap = new Map<
    Network.Request,
    {
      // intercept request id; form: 'interception-job-1.0'
      request: Protocol.Fetch.RequestId;
      phase?: Network.InterceptPhase; // TODO: make non-optional.
      response?: Network.ResponseData; // TODO: make non-optional.
    }
  >();

  constructor(eventManager: EventManager) {
    this.#eventManager = eventManager;
  }

  disposeRequestMap() {
    for (const request of this.#requestMap.values()) {
      request.dispose();
    }

    this.#requestMap.clear();
  }

  /**
   * Adds the given entry to the intercept map.
   * URL patterns are assumed to be parsed.
   *
   * @return The intercept ID.
   */
  addIntercept(value: {
    urlPatterns: Network.UrlPattern[];
    phases: Network.InterceptPhase[];
  }): Network.Intercept {
    const interceptId: Network.Intercept = uuidv4();

    this.#interceptMap.set(interceptId, value);

    return interceptId;
  }

  /**
   * Removes the given intercept from the intercept map.
   * Throws NoSuchInterceptException if the intercept does not exist.
   */
  removeIntercept(intercept: Network.Intercept) {
    if (!this.#interceptMap.has(intercept)) {
      throw new NoSuchInterceptException(
        `Intercept '${intercept}' does not exist.`
      );
    }

    this.#interceptMap.delete(intercept);
  }

  /** Gets parameters for CDP 'Fetch.enable' command from the intercept map. */
  getFetchEnableParams(): Protocol.Fetch.EnableRequest {
    const patterns: Protocol.Fetch.RequestPattern[] = [];

    for (const value of this.#interceptMap.values()) {
      for (const urlPatternSpec of value.urlPatterns) {
        const urlPattern: string =
          NetworkStorage.cdpFromSpecUrlPattern(urlPatternSpec);
        for (const phase of value.phases) {
          if (phase === Network.InterceptPhase.AuthRequired) {
            patterns.push({
              urlPattern,
            });
          } else {
            patterns.push({
              urlPattern,
              requestStage: NetworkStorage.requestStageFromPhase(phase),
            });
          }
        }
      }
    }

    return {
      patterns,
      // If there's at least one intercept that requires auth, enable the
      // 'Fetch.authRequired' event.
      handleAuthRequests: [...this.#interceptMap.values()].some((param) => {
        return param.phases.includes(Network.InterceptPhase.AuthRequired);
      }),
    };
  }

  getRequest(id: Network.Request) {
    return this.#requestMap.get(id);
  }

  createRequest(id: Network.Request, redirectCount?: number) {
    const request = new NetworkRequest(id, this.#eventManager, redirectCount);
    this.#requestMap.set(id, request);
    return request;
  }

  deleteRequest(id: Network.Request) {
    const request = this.#requestMap.get(id);
    if (request) {
      request.dispose();
      this.#requestMap.delete(id);
    }
  }

  /** Converts a URL pattern from the spec to a CDP URL pattern. */
  static cdpFromSpecUrlPattern(urlPattern: Network.UrlPattern): string {
    switch (urlPattern.type) {
      case 'string':
        return urlPattern.pattern;
      case 'pattern':
        return NetworkStorage.buildUrlPatternString(urlPattern);
    }
  }

  static buildUrlPatternString({
    protocol,
    hostname,
    port,
    pathname,
    search,
  }: Network.UrlPatternPattern): string {
    let url: string = '';

    if (protocol) {
      url += `${protocol}`;

      if (!protocol.endsWith(':')) {
        url += ':';
      }

      if (NetworkStorage.isSpecialScheme(protocol)) {
        url += '//';
      }
    }

    if (hostname) {
      url += hostname;
    }

    if (port) {
      url += `:${port}`;
    }

    if (pathname) {
      if (!pathname.startsWith('/')) {
        url += '/';
      }

      url += pathname;
    }

    if (search) {
      if (!search.startsWith('?')) {
        url += '?';
      }

      url += `${search}`;
    }

    return url;
  }

  /**
   * Maps spec Network.InterceptPhase to CDP Fetch.RequestStage.
   * AuthRequired has no CDP equivalent..
   */
  static requestStageFromPhase(
    phase: Network.InterceptPhase
  ): Protocol.Fetch.RequestStage {
    switch (phase) {
      case Network.InterceptPhase.BeforeRequestSent:
        return 'Request';
      case Network.InterceptPhase.ResponseStarted:
        return 'Response';
      case Network.InterceptPhase.AuthRequired:
        throw new Error(
          'AuthRequired is not a valid intercept phase for request stage.'
        );
    }
  }

  /**
   * Returns true if the given protocol is special.
   * Special protocols are those that have a default port.
   *
   * Example inputs: 'http', 'http:'
   *
   * @see https://url.spec.whatwg.org/#special-scheme
   */
  static isSpecialScheme(protocol: string): boolean {
    return ['ftp', 'file', 'http', 'https', 'ws', 'wss'].includes(
      protocol.replace(/:$/, '')
    );
  }

  addBlockedRequest(
    requestId: Network.Request,
    value: {
      request: Protocol.Fetch.RequestId;
      phase?: Network.InterceptPhase; // TODO: make non-optional.
      response?: Network.ResponseData; // TODO: make non-optional.
    }
  ) {
    this.#blockedRequestMap.set(requestId, value);
  }

  removeBlockedRequest(requestId: Network.Request) {
    this.#blockedRequestMap.delete(requestId);
  }

  /**
   * Returns the blocked request associated with the given network ID, if any.
   */
  getBlockedRequest(networkId: Network.Request): {
    request: Protocol.Fetch.RequestId;
    phase?: Network.InterceptPhase; // TODO: make non-optional.
    response?: Network.ResponseData; // TODO: make non-optional.
  } {
    const blockedRequest = this.#blockedRequestMap.get(networkId);
    if (!blockedRequest) {
      throw new NoSuchRequestException(
        `No blocked request found for network id '${networkId}'`
      );
    }
    return blockedRequest;
  }

  /** #@see https://w3c.github.io/webdriver-bidi/#get-the-network-intercepts */
  getNetworkIntercepts(
    event: Exclude<
      ChromiumBidi.Network.EventNames,
      ChromiumBidi.Network.EventNames.FetchError
    >,
    requestId: Network.Request
  ): Network.Intercept[] {
    const request = this.#requestMap.get(requestId);
    if (!request) {
      return [];
    }

    let phase: Network.InterceptPhase | undefined = undefined;
    switch (event) {
      case ChromiumBidi.Network.EventNames.BeforeRequestSent:
        phase = Network.InterceptPhase.BeforeRequestSent;
        break;
      case ChromiumBidi.Network.EventNames.ResponseStarted:
        phase = Network.InterceptPhase.ResponseStarted;
        break;
      case ChromiumBidi.Network.EventNames.AuthRequired:
        phase = Network.InterceptPhase.AuthRequired;
        break;
      case ChromiumBidi.Network.EventNames.ResponseCompleted:
        return [];
    }

    const interceptIds: Network.Intercept[] = [];

    for (const [
      interceptId,
      {phases, urlPatterns},
    ] of this.#interceptMap.entries()) {
      if (phase && phases.includes(phase)) {
        if (urlPatterns.length === 0) {
          interceptIds.push(interceptId);
        } else if (
          urlPatterns.some((urlPattern) =>
            NetworkStorage.matchUrlPattern(urlPattern, request.url)
          )
        ) {
          interceptIds.push(interceptId);
        }
      }
    }

    return interceptIds;
  }

  /** Matches the given URLPattern against the given URL. */
  static matchUrlPattern(
    urlPattern: Network.UrlPattern,
    url: string | undefined
  ): boolean {
    switch (urlPattern.type) {
      case 'string':
        return urlPattern.pattern === url;
      case 'pattern': {
        return (
          new URLPattern({
            protocol: urlPattern.protocol,
            hostname: urlPattern.hostname,
            port: urlPattern.port,
            pathname: urlPattern.pathname,
            search: urlPattern.search,
          }).exec(url) !== null
        );
      }
    }
  }
}
