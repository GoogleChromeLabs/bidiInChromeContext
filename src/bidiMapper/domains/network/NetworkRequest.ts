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

/**
 * @fileoverview `NetworkRequest` represents a single network request and keeps
 * track of all the related CDP events.
 */
import type Protocol from 'devtools-protocol';

import {Deferred} from '../../../utils/Deferred.js';
import type {EventManager} from '../events/EventManager.js';
import {
  Network,
  type BrowsingContext,
  ChromiumBidi,
  type JsUint,
} from '../../../protocol/protocol.js';
import type {Result} from '../../../utils/result.js';
import {assert} from '../../../utils/assert.js';
import type {CdpTarget} from '../context/CdpTarget.js';

import {
  computeResponseHeadersSize,
  bidiNetworkHeadersFromCdpFetchHeaders,
  bidiNetworkHeadersFromCdpNetworkHeaders,
} from './NetworkUtils.js';
import type {NetworkStorage} from './NetworkStorage.js';

/** Abstracts one individual network request. */
export class NetworkRequest {
  static #unknown = 'UNKNOWN';

  /**
   * Each network request has an associated request id, which is a string
   * uniquely identifying that request.
   *
   * The identifier for a request resulting from a redirect matches that of the
   * request that initiated it.
   */
  readonly requestId: Network.Request;

  // TODO: Handle auth required?
  /**
   * Indicates the network intercept phase, if the request is currently blocked.
   * Undefined necessarily implies that the request is not blocked.
   */
  #interceptPhase: Network.InterceptPhase | undefined = undefined;

  #servedFromCache = false;

  #redirectCount: number;

  #eventManager: EventManager;

  #request: {
    info?: Protocol.Network.RequestWillBeSentEvent;
    extraInfo?: Protocol.Network.RequestWillBeSentExtraInfoEvent;
  } = {};

  #response: {
    info?: {
      hasExtraInfo: boolean;
      response: Protocol.Network.Response;
    };
    extraInfo?: Protocol.Network.ResponseReceivedExtraInfoEvent;
  } = {};

  #beforeRequestSentDeferred = new Deferred<Result<void>>();
  #responseCompletedDeferred = new Deferred<Result<void>>();

  #cdpTarget: CdpTarget;

  constructor(
    requestId: Network.Request,
    eventManager: EventManager,
    cdpTarget: CdpTarget,
    redirectCount = 0
  ) {
    this.requestId = requestId;
    this.#eventManager = eventManager;
    this.#cdpTarget = cdpTarget;
    this.#redirectCount = redirectCount;
  }

  get url(): string | undefined {
    return this.#response.info?.response.url ?? this.#request.info?.request.url;
  }

  get redirectCount() {
    return this.#redirectCount;
  }

  get cdpTarget() {
    return this.#cdpTarget;
  }

  isRedirecting(): boolean {
    return Boolean(this.#request.info);
  }

  handleRedirect(event: Protocol.Network.RequestWillBeSentEvent): void {
    this.#queueResponseCompletedEvent();
    this.#response.info = {
      hasExtraInfo: event.redirectHasExtraInfo,
      response: event.redirectResponse!,
    };
    this.#emitEventsIfReady(true);
  }

  #emitEventsIfReady(wasRedirected = false) {
    const requestExtraInfoCompleted =
      // Flush redirects
      wasRedirected ||
      Boolean(this.#request.extraInfo) ||
      // Requests from cache don't have extra info
      this.#servedFromCache ||
      // Sometimes there is no extra info and the response
      // is the only place we can find out
      Boolean(this.#response.info && !this.#response.info.hasExtraInfo) ||
      this.#interceptPhase === Network.InterceptPhase.BeforeRequestSent;

    if (this.#request.info && requestExtraInfoCompleted) {
      this.#beforeRequestSentDeferred.resolve({
        kind: 'success',
        value: undefined,
      });
    }

    const responseExtraInfoCompleted =
      Boolean(this.#response.extraInfo) ||
      // Response from cache don't have extra info
      this.#servedFromCache ||
      // Don't expect extra info if the flag is false
      Boolean(this.#response.info && !this.#response.info.hasExtraInfo) ||
      this.#interceptPhase === Network.InterceptPhase.ResponseStarted;

    if (this.#response.info && responseExtraInfoCompleted) {
      this.#responseCompletedDeferred.resolve({
        kind: 'success',
        value: undefined,
      });
    }
  }

  onRequestWillBeSentEvent(event: Protocol.Network.RequestWillBeSentEvent) {
    this.#request.info = event;
    this.#queueBeforeRequestSentEvent();
    this.#emitEventsIfReady();
  }

  onRequestWillBeSentExtraInfoEvent(
    event: Protocol.Network.RequestWillBeSentExtraInfoEvent
  ) {
    this.#request.extraInfo = event;
    this.#emitEventsIfReady();
  }

  onResponseReceivedExtraInfoEvent(
    event: Protocol.Network.ResponseReceivedExtraInfoEvent
  ) {
    this.#response.extraInfo = event;
    this.#emitEventsIfReady();
  }

  onResponseReceivedEvent(event: Protocol.Network.ResponseReceivedEvent) {
    this.#response.info = event;
    this.#queueResponseCompletedEvent();
    this.#emitEventsIfReady();
  }

  onServedFromCache() {
    this.#servedFromCache = true;
    this.#emitEventsIfReady();
  }

  onLoadingFailedEvent(event: Protocol.Network.LoadingFailedEvent) {
    this.#beforeRequestSentDeferred.resolve({
      kind: 'success',
      value: undefined,
    });
    this.#responseCompletedDeferred.resolve({
      kind: 'error',
      error: new Error('Network event loading failed'),
    });

    this.#eventManager.registerEvent(
      {
        type: 'event',
        method: ChromiumBidi.Network.EventNames.FetchError,
        params: {
          ...this.#getBaseEventParams(),
          errorText: event.errorText,
        },
      },
      this.#context
    );
  }

  /** Fired whenever a network request interception is hit. */
  onRequestPaused(
    params: Protocol.Fetch.RequestPausedEvent,
    networkStorage: NetworkStorage
  ) {
    // The stage of the request can be determined by presence of
    // responseErrorReason and responseStatusCode -- the request is at
    // the response stage if either of these fields is present and in the
    // request stage otherwise.
    let phase: Network.InterceptPhase;
    if (
      params.responseErrorReason === undefined &&
      params.responseStatusCode === undefined
    ) {
      phase = Network.InterceptPhase.BeforeRequestSent;
    } else if (
      params.responseStatusCode === 401 &&
      params.responseStatusText === 'Unauthorized'
    ) {
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
      phase = Network.InterceptPhase.AuthRequired;
    } else {
      phase = Network.InterceptPhase.ResponseStarted;
    }

    const headers = bidiNetworkHeadersFromCdpFetchHeaders(
      // TODO: Use params.request.headers if request?
      params.responseHeaders
    );

    assert(this.requestId === params.networkId);
    networkStorage.addBlockedRequest(this.requestId, {
      request: params.requestId, // intercept request id
      phase,
      // TODO: Finish populating response / ResponseData.
      response: {
        url: params.request.url,
        // TODO: populate.
        protocol: '',
        status: params.responseStatusCode ?? 0,
        statusText: params.responseStatusText ?? '',
        // TODO: populate.
        fromCache: false,
        headers,
        // TODO: populate.
        mimeType: '',
        // TODO: populate.
        bytesReceived: 0,
        headersSize: computeResponseHeadersSize(headers),
        // TODO: consider removing from spec.
        bodySize: 0,
        // TODO: consider removing from spec.
        content: {
          size: 0,
        },
        // TODO: populate.
        authChallenge: undefined,
      },
    });

    this.#interceptPhase = phase;
    this.#emitEventsIfReady();
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-failRequest */
  async failRequest(
    networkId: Network.Request,
    errorReason: Protocol.Network.ErrorReason
  ) {
    await this.#cdpTarget.cdpClient.sendCommand('Fetch.failRequest', {
      requestId: networkId,
      errorReason,
    });

    this.#interceptPhase = undefined;
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueRequest */
  async continueRequest(
    cdpFetchRequestId: Protocol.Fetch.RequestId,
    url?: string,
    method?: string,
    headers?: Protocol.Fetch.HeaderEntry[]
  ) {
    // TODO: Expand.
    await this.#cdpTarget.cdpClient.sendCommand('Fetch.continueRequest', {
      requestId: cdpFetchRequestId,
      url,
      method,
      headers,
      // TODO: Set?
      // postData:,
      // interceptResponse:,
    });

    this.#interceptPhase = undefined;
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueResponse */
  async continueResponse(
    cdpFetchRequestId: Protocol.Fetch.RequestId,
    responseCode?: JsUint,
    responsePhrase?: string,
    responseHeaders?: Protocol.Fetch.HeaderEntry[]
  ) {
    await this.#cdpTarget.cdpClient.sendCommand('Fetch.continueResponse', {
      requestId: cdpFetchRequestId,
      responseCode,
      responsePhrase,
      responseHeaders,
    });

    this.#interceptPhase = undefined;
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-provideResponse */
  async provideResponse(
    cdpFetchRequestId: Protocol.Fetch.RequestId,
    responseCode: JsUint,
    responsePhrase?: string,
    responseHeaders?: Protocol.Fetch.HeaderEntry[],
    body?: string
  ) {
    await this.#cdpTarget.cdpClient.sendCommand('Fetch.fulfillRequest', {
      requestId: cdpFetchRequestId,
      responseCode,
      responsePhrase,
      responseHeaders,
      ...(body ? {body: btoa(body)} : {}), // TODO: Double-check if btoa usage is correct.
    });

    this.#interceptPhase = undefined;
  }

  dispose() {
    const result = {
      kind: 'error' as const,
      error: new Error('Network processor detached'),
    };
    this.#beforeRequestSentDeferred.resolve(result);
    this.#responseCompletedDeferred.resolve(result);
  }

  get #context() {
    return this.#request.info?.frameId ?? null;
  }

  #getBaseEventParams(phase?: Network.InterceptPhase): Network.BaseParameters {
    return {
      isBlocked: phase !== undefined && phase === this.#interceptPhase,
      context: this.#context,
      navigation: this.#getNavigationId(),
      redirectCount: this.#redirectCount,
      request: this.#getRequestData(),
      // Timestamp should be in milliseconds, while CDP provides it in seconds.
      timestamp: Math.round((this.#request.info?.wallTime ?? 0) * 1000),
    };
  }

  #getNavigationId(): BrowsingContext.Navigation | null {
    if (
      !this.#request.info ||
      !this.#request.info.loaderId ||
      // When we navigate all CDP network events have `loaderId`
      // CDP's `loaderId` and `requestId` match when
      // that request triggered the loading
      this.#request.info.loaderId !== this.#request.info.requestId
    ) {
      return null;
    }
    return this.#request.info.loaderId;
  }

  #getRequestData(): Network.RequestData {
    const cookies = this.#request.extraInfo
      ? NetworkRequest.#getCookies(this.#request.extraInfo.associatedCookies)
      : [];

    const headers = bidiNetworkHeadersFromCdpNetworkHeaders(
      this.#request.info?.request.headers
    );

    return {
      request: this.#request.info?.requestId ?? NetworkRequest.#unknown,
      url: this.#request.info?.request.url ?? NetworkRequest.#unknown,
      method: this.#request.info?.request.method ?? NetworkRequest.#unknown,
      headers,
      cookies,
      // TODO: implement.
      headersSize: -1,
      // TODO: implement.
      bodySize: 0,
      timings: this.#getTimings(),
    };
  }
  // TODO: implement.
  #getTimings(): Network.FetchTimingInfo {
    return {
      timeOrigin: 0,
      requestTime: 0,
      redirectStart: 0,
      redirectEnd: 0,
      fetchStart: 0,
      dnsStart: 0,
      dnsEnd: 0,
      connectStart: 0,
      connectEnd: 0,
      tlsStart: 0,
      requestStart: 0,
      responseStart: 0,
      responseEnd: 0,
    };
  }

  #queueBeforeRequestSentEvent() {
    if (this.#isIgnoredEvent()) {
      return;
    }
    this.#eventManager.registerPromiseEvent(
      this.#beforeRequestSentDeferred.then((result) => {
        if (result.kind === 'success') {
          return {
            kind: 'success',
            value: Object.assign(this.#getBeforeRequestEvent(), {
              type: 'event' as const,
            }),
          };
        }
        return result;
      }),
      this.#context,
      ChromiumBidi.Network.EventNames.BeforeRequestSent
    );
  }

  #getBeforeRequestEvent(): Network.BeforeRequestSent {
    assert(this.#request.info, 'RequestWillBeSentEvent is not set');

    return {
      method: ChromiumBidi.Network.EventNames.BeforeRequestSent,
      params: {
        ...this.#getBaseEventParams(Network.InterceptPhase.BeforeRequestSent),
        initiator: {
          type: NetworkRequest.#getInitiatorType(
            this.#request.info.initiator.type
          ),
        },
      },
    };
  }

  #queueResponseCompletedEvent() {
    if (this.#isIgnoredEvent()) {
      return;
    }
    this.#eventManager.registerPromiseEvent(
      this.#responseCompletedDeferred.then((result) => {
        if (result.kind === 'success') {
          return {
            kind: 'success',
            value: Object.assign(this.#getResponseReceivedEvent(), {
              type: 'event' as const,
            }),
          };
        }
        return result;
      }),
      this.#context,
      ChromiumBidi.Network.EventNames.ResponseCompleted
    );
  }

  #getResponseReceivedEvent(): Network.ResponseCompleted {
    assert(this.#request.info, 'RequestWillBeSentEvent is not set');
    assert(this.#response.info, 'ResponseReceivedEvent is not set');

    // Chromium sends wrong extraInfo events for responses served from cache.
    // See https://github.com/puppeteer/puppeteer/issues/9965 and
    // https://crbug.com/1340398.
    if (this.#response.info.response.fromDiskCache) {
      this.#response.extraInfo = undefined;
    }

    const headers = bidiNetworkHeadersFromCdpNetworkHeaders(
      this.#response.info.response.headers
    );

    return {
      method: ChromiumBidi.Network.EventNames.ResponseCompleted,
      params: {
        ...this.#getBaseEventParams(),
        response: {
          url: this.#response.info.response.url ?? NetworkRequest.#unknown,
          protocol: this.#response.info.response.protocol ?? '',
          status:
            this.#response.extraInfo?.statusCode ??
            this.#response.info.response.status,
          statusText: this.#response.info.response.statusText,
          fromCache:
            this.#response.info.response.fromDiskCache ||
            this.#response.info.response.fromPrefetchCache ||
            this.#servedFromCache,
          headers,
          mimeType: this.#response.info.response.mimeType,
          bytesReceived: this.#response.info.response.encodedDataLength,
          headersSize: computeResponseHeadersSize(headers),
          // TODO: consider removing from spec.
          bodySize: 0,
          content: {
            // TODO: consider removing from spec.
            size: 0,
          },
        },
      },
    };
  }

  #isIgnoredEvent(): boolean {
    return this.#request.info?.request.url.endsWith('/favicon.ico') ?? false;
  }

  static #getInitiatorType(
    initiatorType: Protocol.Network.Initiator['type']
  ): Network.Initiator['type'] {
    switch (initiatorType) {
      case 'parser':
      case 'script':
      case 'preflight':
        return initiatorType;
      default:
        return 'other';
    }
  }

  static #getCookies(
    associatedCookies: Protocol.Network.BlockedCookieWithReason[]
  ): Network.Cookie[] {
    return associatedCookies
      .filter(({blockedReasons}) => {
        return !Array.isArray(blockedReasons) || blockedReasons.length === 0;
      })
      .map(({cookie}) => {
        return {
          name: cookie.name,
          value: {
            type: 'string',
            value: cookie.value,
          },
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          size: cookie.size,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: NetworkRequest.#getCookiesSameSite(cookie.sameSite),
        };
      });
  }

  static #getCookiesSameSite(
    cdpSameSiteValue?: string
  ): Network.Cookie['sameSite'] {
    switch (cdpSameSiteValue) {
      case 'Strict':
        return 'strict';
      case 'Lax':
        return 'lax';
      default:
        return 'none';
    }
  }
}
