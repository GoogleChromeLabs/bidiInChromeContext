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
import type {Protocol} from 'devtools-protocol';

import {
  Network,
  type BrowsingContext,
  ChromiumBidi,
  type NetworkEvent,
} from '../../../protocol/protocol.js';
import {assert} from '../../../utils/assert.js';
import {LogType, type LoggerFn} from '../../../utils/log.js';
import type {CdpTarget} from '../context/CdpTarget.js';
import type {EventManager} from '../session/EventManager.js';

import type {NetworkStorage} from './NetworkStorage.js';
import {
  computeHeadersSize,
  bidiNetworkHeadersFromCdpNetworkHeaders,
  cdpToBiDiCookie,
} from './NetworkUtils.js';

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
  #id: Network.Request;

  #fetchId?: Protocol.Fetch.RequestId;

  /**
   * Indicates the network intercept phase, if the request is currently blocked.
   * Undefined necessarily implies that the request is not blocked.
   */
  #interceptPhase?: Network.InterceptPhase;

  #servedFromCache = false;

  #redirectCount: number;

  #request: {
    info?: Protocol.Network.RequestWillBeSentEvent;
    extraInfo?: Protocol.Network.RequestWillBeSentExtraInfoEvent;
    paused?: Protocol.Fetch.RequestPausedEvent;
  } = {};

  #response: {
    hasExtraInfo?: boolean;
    info?: Protocol.Network.Response;
    extraInfo?: Protocol.Network.ResponseReceivedExtraInfoEvent;
    paused?: Protocol.Fetch.RequestPausedEvent;
  } = {};

  #eventManager: EventManager;
  #networkStorage: NetworkStorage;
  #cdpTarget: CdpTarget;
  #logger?: LoggerFn;

  #emittedEvents: Record<ChromiumBidi.Network.EventNames, boolean> = {
    [ChromiumBidi.Network.EventNames.AuthRequired]: false,
    [ChromiumBidi.Network.EventNames.BeforeRequestSent]: false,
    [ChromiumBidi.Network.EventNames.FetchError]: false,
    [ChromiumBidi.Network.EventNames.ResponseCompleted]: false,
    [ChromiumBidi.Network.EventNames.ResponseStarted]: false,
  };

  constructor(
    id: Network.Request,
    eventManager: EventManager,
    networkStorage: NetworkStorage,
    cdpTarget: CdpTarget,
    redirectCount = 0,
    logger?: LoggerFn
  ) {
    this.#id = id;
    this.#eventManager = eventManager;
    this.#networkStorage = networkStorage;
    this.#cdpTarget = cdpTarget;
    this.#redirectCount = redirectCount;
    this.#logger = logger;
  }

  get id(): string {
    return this.#id;
  }

  get fetchId(): string | undefined {
    return this.#fetchId;
  }

  /**
   * When block returns the phase for it
   */
  get blockedIn(): Network.InterceptPhase | undefined {
    return this.#interceptPhase;
  }

  get url(): string | undefined {
    return (
      this.#response.info?.url ??
      this.#request.info?.request.url ??
      this.#response.paused?.request.url ??
      this.#request.paused?.request.url
    );
  }

  get redirectCount() {
    return this.#redirectCount;
  }

  get cdpClient() {
    return this.#cdpTarget.cdpClient;
  }

  isRedirecting(): boolean {
    return Boolean(this.#request.info);
  }

  #isBlockedByInPhase(phase: Network.InterceptPhase) {
    return this.#networkStorage.requestBlockedBy(this, phase);
  }

  #isBlockedInPhase(phase: Network.InterceptPhase) {
    return this.#isBlockedByInPhase(phase).size > 0;
  }

  handleRedirect(event: Protocol.Network.RequestWillBeSentEvent) {
    this.#response.hasExtraInfo = event.redirectHasExtraInfo;
    this.#response.info = event.redirectResponse!;
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
      Boolean(this.#response.info && !this.#response.hasExtraInfo);

    const requestInterceptionExpected = this.#isBlockedInPhase(
      Network.InterceptPhase.BeforeRequestSent
    );

    const requestInterceptionCompleted =
      !requestInterceptionExpected ||
      (requestInterceptionExpected && Boolean(this.#request.paused));

    if (
      Boolean(this.#request.info) &&
      (requestInterceptionExpected
        ? requestInterceptionCompleted
        : requestExtraInfoCompleted)
    ) {
      this.#emitEvent(this.#getBeforeRequestEvent.bind(this));
    }

    const responseExtraInfoCompleted =
      Boolean(this.#response.extraInfo) ||
      // Response from cache don't have extra info
      this.#servedFromCache ||
      // Don't expect extra info if the flag is false
      Boolean(this.#response.info && !this.#response.hasExtraInfo);

    const responseInterceptionExpected = this.#isBlockedInPhase(
      Network.InterceptPhase.ResponseStarted
    );

    if (
      this.#response.info ||
      (responseInterceptionExpected && Boolean(this.#response.paused))
    ) {
      this.#emitEvent(this.#getResponseStartedEvent.bind(this));
    }

    const responseInterceptionCompleted =
      !responseInterceptionExpected ||
      (responseInterceptionExpected && Boolean(this.#response.paused));

    if (
      Boolean(this.#response.info) &&
      responseExtraInfoCompleted &&
      responseInterceptionCompleted
    ) {
      this.#emitEvent(this.#getResponseReceivedEvent.bind(this));
    }
  }

  onRequestWillBeSentEvent(event: Protocol.Network.RequestWillBeSentEvent) {
    this.#request.info = event;
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
    this.#response.hasExtraInfo = event.hasExtraInfo;
    this.#response.info = event.response;
    this.#emitEventsIfReady();
  }

  onServedFromCache() {
    this.#servedFromCache = true;
    this.#emitEventsIfReady();
  }

  onLoadingFailedEvent(event: Protocol.Network.LoadingFailedEvent) {
    this.#emitEvent(() => {
      return {
        method: ChromiumBidi.Network.EventNames.FetchError,
        params: {
          ...this.#getBaseEventParams(),
          errorText: event.errorText,
        },
      };
    });
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-failRequest */
  async failRequest(errorReason: Protocol.Network.ErrorReason) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    this.#interceptPhase = undefined;
    await this.cdpClient.sendCommand('Fetch.failRequest', {
      requestId: this.#fetchId,
      errorReason,
    });
  }

  onRequestPaused(event: Protocol.Fetch.RequestPausedEvent) {
    this.#fetchId = event.requestId;

    // CDP https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#event-requestPaused
    if (event.responseStatusCode || event.responseErrorReason) {
      this.#response.paused = event;
      this.#interceptPhase = Network.InterceptPhase.ResponseStarted;
      if (!this.#isBlockedInPhase(Network.InterceptPhase.ResponseStarted)) {
        void this.continueResponse();
      }
    } else {
      this.#request.paused = event;
      this.#interceptPhase = Network.InterceptPhase.BeforeRequestSent;
      if (!this.#isBlockedInPhase(Network.InterceptPhase.BeforeRequestSent)) {
        void this.continueRequest();
      }
    }

    this.#emitEventsIfReady();
  }

  onAuthRequired(event: Protocol.Fetch.AuthRequiredEvent) {
    this.#fetchId = event.requestId;
    this.#interceptPhase = Network.InterceptPhase.AuthRequired;
    if (!this.#isBlockedInPhase(Network.InterceptPhase.AuthRequired)) {
      void this.continueWithAuth();
    }

    this.#emitEvent(() => {
      return {
        method: ChromiumBidi.Network.EventNames.AuthRequired,
        params: {
          ...this.#getBaseEventParams(Network.InterceptPhase.AuthRequired),
          // TODO: Why is this on the Spec
          // How are we suppose to know the response if we are blocked by Auth
          response: {} as any,
        },
      };
    });
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueRequest */
  async continueRequest(
    url?: string,
    method?: string,
    headers?: Protocol.Fetch.HeaderEntry[]
  ) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    this.#interceptPhase = undefined;
    await this.cdpClient.sendCommand('Fetch.continueRequest', {
      requestId: this.#fetchId,
      url,
      method,
      headers,
      // TODO: Set?
      // postData:,
      // interceptResponse:,
    });
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueResponse */
  async continueResponse({
    responseCode,
    responsePhrase,
    responseHeaders,
  }: Omit<Protocol.Fetch.ContinueResponseRequest, 'requestId'> = {}) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    this.#interceptPhase = undefined;
    await this.cdpClient.sendCommand('Fetch.continueResponse', {
      requestId: this.#fetchId,
      responseCode,
      responsePhrase,
      responseHeaders,
    });
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueWithAuth */
  async continueWithAuth(
    authChallengeResponse: Protocol.Fetch.ContinueWithAuthRequest['authChallengeResponse'] = {
      response: 'Default',
    }
  ) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    this.#interceptPhase = undefined;
    await this.cdpClient.sendCommand('Fetch.continueWithAuth', {
      requestId: this.#fetchId,
      authChallengeResponse,
    });
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-provideResponse */
  async provideResponse({
    responseCode,
    responsePhrase,
    responseHeaders,
    body,
  }: Omit<Protocol.Fetch.FulfillRequestRequest, 'requestId'>) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    this.#interceptPhase = undefined;
    await this.cdpClient.sendCommand('Fetch.fulfillRequest', {
      requestId: this.#fetchId,
      responseCode,
      responsePhrase,
      responseHeaders,
      ...(body ? {body: btoa(body)} : {}), // TODO: Double-check if btoa usage is correct.
    });
  }

  get #context() {
    return this.#request.info?.frameId ?? null;
  }

  /** Returns the HTTP status code associated with this request if any. */
  get statusCode(): number {
    return (
      this.#response.paused?.responseStatusCode ??
      this.#response.extraInfo?.statusCode ??
      this.#response.info?.status ??
      -1 // TODO: Throw an exception or use some other status code?
    );
  }

  #emitEvent(getEvent: () => NetworkEvent) {
    let event: NetworkEvent;
    try {
      event = getEvent();
    } catch (error) {
      this.#logger?.(LogType.debugError, error);
      throw error;
    }

    if (this.#isIgnoredEvent() || this.#emittedEvents[event.method]) {
      return;
    }

    this.#emittedEvents[event.method] = true;
    this.#eventManager.registerEvent(
      Object.assign(event, {
        type: 'event' as const,
      }),
      this.#context
    );
  }

  #getBaseEventParams(phase?: Network.InterceptPhase): Network.BaseParameters {
    const interceptProps: Pick<
      Network.BaseParameters,
      'isBlocked' | 'intercepts'
    > = {
      isBlocked: false,
    };

    if (phase) {
      const blockedBy = this.#isBlockedByInPhase(phase);
      interceptProps.isBlocked = blockedBy.size > 0;
      if (interceptProps.isBlocked) {
        interceptProps.intercepts = [...blockedBy] as [
          Network.Intercept,
          ...Network.Intercept[],
        ];
      }
    }

    return {
      context: this.#context,
      navigation: this.#getNavigationId(),
      redirectCount: this.#redirectCount,
      request: this.#getRequestData(),
      // Timestamp should be in milliseconds, while CDP provides it in seconds.
      timestamp: Math.round((this.#request.info?.wallTime ?? 0) * 1000),
      // Contains isBlocked and intercepts
      ...interceptProps,
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
      headersSize: computeHeadersSize(headers),
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

  #getResponseStartedEvent(): Network.ResponseStarted {
    assert(this.#request.info, 'RequestWillBeSentEvent is not set');
    assert(
      // The response paused comes before any data for the response
      this.#response.paused || this.#response.info,
      'ResponseReceivedEvent is not set'
    );

    // Chromium sends wrong extraInfo events for responses served from cache.
    // See https://github.com/puppeteer/puppeteer/issues/9965 and
    // https://crbug.com/1340398.
    if (this.#response.info?.fromDiskCache) {
      this.#response.extraInfo = undefined;
    }

    // TODO: get headers from Fetch.requestPaused
    const headers = bidiNetworkHeadersFromCdpNetworkHeaders(
      this.#response.info?.headers
    );

    return {
      method: ChromiumBidi.Network.EventNames.ResponseStarted,
      params: {
        ...this.#getBaseEventParams(Network.InterceptPhase.ResponseStarted),
        response: {
          url:
            this.#response.info?.url ??
            this.#response.paused?.request.url ??
            NetworkRequest.#unknown,
          protocol: this.#response.info?.protocol ?? '',
          status: this.statusCode,
          statusText:
            this.#response.info?.statusText ||
            this.#response.paused?.responseStatusText ||
            '',
          fromCache:
            this.#response.info?.fromDiskCache ||
            this.#response.info?.fromPrefetchCache ||
            this.#servedFromCache,
          headers,
          mimeType: this.#response.info?.mimeType || '',
          bytesReceived: this.#response.info?.encodedDataLength || 0,
          headersSize: computeHeadersSize(headers),
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

  #getResponseReceivedEvent(): Network.ResponseCompleted {
    assert(this.#request.info, 'RequestWillBeSentEvent is not set');
    assert(this.#response.info, 'ResponseReceivedEvent is not set');

    // Chromium sends wrong extraInfo events for responses served from cache.
    // See https://github.com/puppeteer/puppeteer/issues/9965 and
    // https://crbug.com/1340398.
    if (this.#response.info.fromDiskCache) {
      this.#response.extraInfo = undefined;
    }

    const headers = bidiNetworkHeadersFromCdpNetworkHeaders(
      this.#response.info.headers
    );

    return {
      method: ChromiumBidi.Network.EventNames.ResponseCompleted,
      params: {
        ...this.#getBaseEventParams(),
        response: {
          url: this.#response.info.url ?? NetworkRequest.#unknown,
          protocol: this.#response.info.protocol ?? '',
          status: this.statusCode,
          statusText: this.#response.info.statusText,
          fromCache:
            this.#response.info.fromDiskCache ||
            this.#response.info.fromPrefetchCache ||
            this.#servedFromCache,
          headers,
          mimeType: this.#response.info.mimeType,
          bytesReceived: this.#response.info.encodedDataLength,
          headersSize: computeHeadersSize(headers),
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
    associatedCookies: Protocol.Network.AssociatedCookie[]
  ): Network.Cookie[] {
    return associatedCookies
      .filter(({blockedReasons}) => {
        return !Array.isArray(blockedReasons) || blockedReasons.length === 0;
      })
      .map(({cookie}) => cdpToBiDiCookie(cookie));
  }
}
