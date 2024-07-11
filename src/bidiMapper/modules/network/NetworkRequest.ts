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
import {Deferred} from '../../../utils/Deferred.js';
import {LogType, type LoggerFn} from '../../../utils/log.js';
import type {CdpTarget} from '../cdp/CdpTarget.js';
import type {EventManager} from '../session/EventManager.js';

import type {NetworkStorage} from './NetworkStorage.js';
import {
  computeHeadersSize,
  bidiNetworkHeadersFromCdpNetworkHeaders,
  cdpToBiDiCookie,
  cdpFetchHeadersFromBidiNetworkHeaders,
  cdpAuthChallengeResponseFromBidiAuthContinueWithAuthAction,
  bidiBodySizeFromCdpPostDataEntries,
  networkHeaderFromCookieHeaders,
} from './NetworkUtils.js';

const REALM_REGEX = /(?<=realm=").*(?=")/;

/** Abstracts one individual network request. */
export class NetworkRequest {
  static unknownParameter = 'UNKNOWN';

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
    auth?: Protocol.Fetch.AuthRequiredEvent;
  } = {};

  #requestOverrides?: {
    url?: string;
    method?: string;
    headers?: Network.Header[];
    cookies?: Network.CookieHeader[];
    bodySize?: number;
  };

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

  waitNextPhase = new Deferred<void>();

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
   * When blocked returns the phase for it
   */
  get interceptPhase(): Network.InterceptPhase | undefined {
    return this.#interceptPhase;
  }

  get url(): string {
    const fragment =
      this.#request.info?.request.urlFragment ??
      this.#request.paused?.request.urlFragment ??
      '';
    const url =
      this.#response.info?.url ??
      this.#response.paused?.request.url ??
      this.#requestOverrides?.url ??
      this.#request.auth?.request.url ??
      this.#request.info?.request.url ??
      this.#request.paused?.request.url ??
      NetworkRequest.unknownParameter;

    return `${url}${fragment}`;
  }

  get redirectCount() {
    return this.#redirectCount;
  }

  get cdpTarget() {
    return this.#cdpTarget;
  }

  get cdpClient() {
    return this.#cdpTarget.cdpClient;
  }

  isRedirecting(): boolean {
    return Boolean(this.#request.info);
  }

  #isDataUrl(): boolean {
    return this.url.startsWith('data:');
  }

  get #method(): string | undefined {
    return (
      this.#requestOverrides?.method ??
      this.#request.info?.request.method ??
      this.#request.paused?.request.method ??
      this.#request.auth?.request.method ??
      this.#response.paused?.request.method
    );
  }

  get #navigationId(): BrowsingContext.Navigation | null {
    // Heuristic to determine if this is a navigation request, and if not return null.
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

    // Get virtual navigation ID from the browsing context.
    return this.#networkStorage.getVirtualNavigationId(
      this.#context ?? undefined
    );
  }

  get #cookies() {
    let cookies: Network.Cookie[] = [];
    if (this.#request.extraInfo) {
      cookies = this.#request.extraInfo.associatedCookies
        .filter(({blockedReasons}) => {
          return !Array.isArray(blockedReasons) || blockedReasons.length === 0;
        })
        .map(({cookie}) => cdpToBiDiCookie(cookie));
    }
    return cookies;
  }

  get #bodySize() {
    let bodySize = 0;
    if (typeof this.#requestOverrides?.bodySize === 'number') {
      bodySize = this.#requestOverrides.bodySize;
    } else {
      bodySize = bidiBodySizeFromCdpPostDataEntries(
        this.#request.info?.request.postDataEntries ?? []
      );
    }
    return bodySize;
  }

  get #context() {
    return (
      this.#response.paused?.frameId ??
      this.#request.info?.frameId ??
      this.#request.paused?.frameId ??
      this.#request.auth?.frameId ??
      null
    );
  }

  /** Returns the HTTP status code associated with this request if any. */
  get #statusCode(): number | undefined {
    return (
      this.#response.paused?.responseStatusCode ??
      this.#response.extraInfo?.statusCode ??
      this.#response.info?.status
    );
  }

  get #requestHeaders(): Network.Header[] {
    let headers: Network.Header[] = [];
    if (this.#requestOverrides?.headers) {
      headers = this.#requestOverrides.headers;
    } else {
      headers = [
        ...bidiNetworkHeadersFromCdpNetworkHeaders(
          this.#request.info?.request.headers
        ),
        ...bidiNetworkHeadersFromCdpNetworkHeaders(
          this.#request.extraInfo?.headers
        ),
      ];
    }

    return headers;
  }

  get #authChallenges(): Network.AuthChallenge[] | undefined {
    // TODO: get headers from Fetch.requestPaused
    if (!this.#response.info) {
      return;
    }

    if (!(this.#statusCode === 401 || this.#statusCode === 407)) {
      return undefined;
    }

    const headerName =
      this.#statusCode === 401 ? 'WWW-Authenticate' : 'Proxy-Authenticate';

    const authChallenges = [];
    for (const [header, value] of Object.entries(this.#response.info.headers)) {
      // TODO: Do a proper match based on https://httpwg.org/specs/rfc9110.html#credentials
      // Or verify this works
      if (
        header.localeCompare(headerName, undefined, {sensitivity: 'base'}) === 0
      ) {
        authChallenges.push({
          scheme: value.split(' ').at(0) ?? '',
          realm: value.match(REALM_REGEX)?.at(0) ?? '',
        });
      }
    }

    return authChallenges;
  }

  // TODO: implement.
  get #timings(): Network.FetchTimingInfo {
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

  #phaseChanged() {
    this.waitNextPhase.resolve();
    this.waitNextPhase = new Deferred();
  }

  #interceptsInPhase(phase: Network.InterceptPhase) {
    if (!this.#cdpTarget.isSubscribedTo(`network.${phase}`)) {
      return new Set();
    }

    return this.#networkStorage.getInterceptsForPhase(this, phase);
  }

  #isBlockedInPhase(phase: Network.InterceptPhase) {
    return this.#interceptsInPhase(phase).size > 0;
  }

  handleRedirect(event: Protocol.Network.RequestWillBeSentEvent) {
    // TODO: use event.redirectResponse;
    // Temporary workaround to emit ResponseCompleted event for redirects
    this.#response.hasExtraInfo = false;
    this.#response.info = event.redirectResponse!;
    this.#emitEventsIfReady({
      wasRedirected: true,
    });
  }

  #emitEventsIfReady(
    options: {
      wasRedirected?: boolean;
      hasFailed?: boolean;
    } = {}
  ) {
    const requestExtraInfoCompleted =
      // Flush redirects
      options.wasRedirected ||
      options.hasFailed ||
      this.#isDataUrl() ||
      Boolean(this.#request.extraInfo) ||
      // Requests from cache don't have extra info
      this.#servedFromCache ||
      // Sometimes there is no extra info and the response
      // is the only place we can find out
      Boolean(this.#response.info && !this.#response.hasExtraInfo);

    const noInterceptionExpected =
      // We can't intercept data urls from CDP
      this.#isDataUrl() ||
      // Cached requests never hit the network
      this.#servedFromCache;

    const requestInterceptionExpected =
      !noInterceptionExpected &&
      this.#isBlockedInPhase(Network.InterceptPhase.BeforeRequestSent);

    const requestInterceptionCompleted =
      !requestInterceptionExpected ||
      (requestInterceptionExpected && Boolean(this.#request.paused));

    if (
      Boolean(this.#request.info) &&
      (requestInterceptionExpected
        ? requestInterceptionCompleted
        : requestExtraInfoCompleted)
    ) {ODO.bind(this));
    }

    const responseExtraInfoCompleted =
      Boolean(this.#response.extraInfo) ||
      // Response from cache don't have extra info
      this.#servedFromCache ||
      // Don't expect extra info if the flag is false
      Boolean(this.#response.info && !this.#response.hasExtraInfo);

    const responseInterceptionExpected =
      !noInterceptionExpected &&
      this.#isBlockedInPhase(Network.InterceptPhase.ResponseStarted);

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
      this.#networkStorage.deleteRequest(this.id);
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
    if (
      event.statusCode >= 300 &&
      event.statusCode <= 399 &&
      this.#request.info &&
      event.headers['location'] === this.#request.info.request.url
    ) {
      // We received the Response Extra info for the redirect
      // Too late so we need to skip it as it will
      // fire wrongly for the last one
      return;
    }
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
    this.#emitEventsIfReady({
      hasFailed: true,
    });

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

    await this.cdpClient.sendCommand('Fetch.failRequest', {
      requestId: this.#fetchId,
      errorReason,
    });
    this.#interceptPhase = undefined;
  }

  onRequestPaused(event: Protocol.Fetch.RequestPausedEvent) {
    this.#fetchId = event.requestId;

    // CDP https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#event-requestPaused
    if (event.responseStatusCode || event.responseErrorReason) {
      this.#response.paused = event;

      if (
        this.#isBlockedInPhase(Network.InterceptPhase.ResponseStarted) &&
        // CDP may emit multiple events for a single request
        !this.#emittedEvents[ChromiumBidi.Network.EventNames.ResponseStarted] &&
        // Continue all response that have not enabled Network domain
        this.#fetchId !== this.id
      ) {
        this.#interceptPhase = Network.InterceptPhase.ResponseStarted;
      } else {
        void this.#continueResponse();
      }
    } else {
      this.#request.paused = event;
      if (
        this.#isBlockedInPhase(Network.InterceptPhase.BeforeRequestSent) &&
        // CDP may emit multiple events for a single request
        !this.#emittedEvents[
          ChromiumBidi.Network.EventNames.BeforeRequestSent
        ] &&
        // Continue all requests that have not enabled Network domain
        this.#fetchId !== this.id
      ) {
        this.#interceptPhase = Network.InterceptPhase.BeforeRequestSent;
      } else {
        void this.#continueRequest();
      }
    }

    this.#emitEventsIfReady();
  }

  onAuthRequired(event: Protocol.Fetch.AuthRequiredEvent) {
    this.#fetchId = event.requestId;
    this.#request.auth = event;

    if (
      this.#isBlockedInPhase(Network.InterceptPhase.AuthRequired) &&
      // Continue all auth requests that have not enabled Network domain
      this.#fetchId !== this.id
    ) {
      this.#interceptPhase = Network.InterceptPhase.AuthRequired;
    } else {
      void this.#continueWithAuth({
        response: 'Default',
      });
    }

    this.#emitEvent(() => {
      return {
        method: ChromiumBidi.Network.EventNames.AuthRequired,
        params: {
          ...this.#getBaseEventParams(Network.InterceptPhase.AuthRequired),
          response: this.#getResponseEventParams(),
        },
      };
    });
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueRequest */
  async continueRequest(
    overrides: Omit<Network.ContinueRequestParameters, 'request'> = {}
  ) {
    const overrideHeaders = this.#getOverrideHeader(
      overrides.headers,
      overrides.cookies
    );
    const headers = cdpFetchHeadersFromBidiNetworkHeaders(overrideHeaders);
    const postData = getCdpBodyFromBiDiBytesValue(overrides.body);

    await this.#continueRequest({
      url: overrides.url,
      method: overrides.method,
      headers,
      postData,
    });

    this.#requestOverrides = {
      url: overrides.url,
      method: overrides.method,
      headers: overrides.headers,
      cookies: overrides.cookies,
      bodySize: getSizeFromBiDiBytesValue(overrides.body),
    };
  }

  async #continueRequest(
    overrides: Omit<Protocol.Fetch.ContinueRequestRequest, 'requestId'> = {}
  ) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    await this.cdpClient.sendCommand('Fetch.continueRequest', {
      requestId: this.#fetchId,
      url: overrides.url,
      method: overrides.method,
      headers: overrides.headers,
      postData: overrides.postData,
    });

    this.#interceptPhase = undefined;
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueResponse */
  async continueResponse(
    overrides: Omit<Network.ContinueResponseParameters, 'request'> = {}
  ) {
    if (this.interceptPhase === Network.InterceptPhase.AuthRequired) {
      if (overrides.credentials) {
        await Promise.all([
          this.waitNextPhase,
          await this.#continueWithAuth({
            response: 'ProvideCredentials',
            username: overrides.credentials.username,
            password: overrides.credentials.password,
          }),
        ]);
      } else {
        // We need to use `ProvideCredentials`
        // As `Default` may cancel the request
        return await this.#continueWithAuth({
          response: 'ProvideCredentials',
        });
      }
    }

    if (this.#interceptPhase === Network.InterceptPhase.ResponseStarted) {
      const overrideHeaders = this.#getOverrideHeader(
        overrides.headers,
        overrides.cookies
      );
      const responseHeaders =
        cdpFetchHeadersFromBidiNetworkHeaders(overrideHeaders);

      await this.#continueResponse({
        responseCode: overrides.statusCode,
        responsePhrase: overrides.reasonPhrase,
        responseHeaders,
      });
    }
  }

  async #continueResponse({
    responseCode,
    responsePhrase,
    responseHeaders,
  }: Omit<Protocol.Fetch.ContinueResponseRequest, 'requestId'> = {}) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    await this.cdpClient.sendCommand('Fetch.continueResponse', {
      requestId: this.#fetchId,
      responseCode,
      responsePhrase,
      responseHeaders,
    });
    this.#interceptPhase = undefined;
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueWithAuth */
  async continueWithAuth(
    authChallenge: Omit<Network.ContinueWithAuthParameters, 'request'>
  ) {
    let username: string | undefined;
    let password: string | undefined;

    if (authChallenge.action === 'provideCredentials') {
      const {credentials} =
        authChallenge as Network.ContinueWithAuthCredentials;

      username = credentials.username;
      password = credentials.password;
    }

    const response = cdpAuthChallengeResponseFromBidiAuthContinueWithAuthAction(
      authChallenge.action
    );

    await this.#continueWithAuth({
      response,
      username,
      password,
    });
  }

  /** @see https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-provideResponse */
  async provideResponse(
    overrides: Omit<Network.ProvideResponseParameters, 'request'>
  ) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    // We need to pass through if the request is already in
    // AuthRequired phase
    if (this.interceptPhase === Network.InterceptPhase.AuthRequired) {
      // We need to use `ProvideCredentials`
      // As `Default` may cancel the request
      return await this.#continueWithAuth({
        response: 'ProvideCredentials',
      });
    }

    // If we don't modify the response
    // just continue the request
    if (!overrides.body && !overrides.headers) {
      return await this.#continueRequest();
    }

    const overrideHeaders = this.#getOverrideHeader(
      overrides.headers,
      overrides.cookies
    );
    const responseHeaders =
      cdpFetchHeadersFromBidiNetworkHeaders(overrideHeaders);

    const responseCode = overrides.statusCode ?? this.#statusCode ?? 200;

    await this.cdpClient.sendCommand('Fetch.fulfillRequest', {
      requestId: this.#fetchId,
      responseCode,
      responsePhrase: overrides.reasonPhrase,
      responseHeaders,
      body: getCdpBodyFromBiDiBytesValue(overrides.body),
    });
    this.#interceptPhase = undefined;
  }

  async #continueWithAuth(
    authChallengeResponse: Protocol.Fetch.ContinueWithAuthRequest['authChallengeResponse']
  ) {
    assert(this.#fetchId, 'Network Interception not set-up.');

    await this.cdpClient.sendCommand('Fetch.continueWithAuth', {
      requestId: this.#fetchId,
      authChallengeResponse,
    });
    this.#interceptPhase = undefined;
  }

  #emitEvent(getEvent: () => NetworkEvent) {
    let event: NetworkEvent;
    try {
      event = getEvent();
    } catch (error) {
      this.#logger?.(LogType.debugError, error);
      return;
    }

    if (
      this.#isIgnoredEvent() ||
      (this.#emittedEvents[event.method] &&
        // Special case this event can be emitted multiple times
        event.method !== ChromiumBidi.Network.EventNames.AuthRequired)
    ) {
      return;
    }
    this.#phaseChanged();

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
      const blockedBy = this.#interceptsInPhase(phase);
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
      navigation: this.#navigationId,
      redirectCount: this.#redirectCount,
      request: this.#getRequestData(),
      // Timestamp should be in milliseconds, while CDP provides it in seconds.
      timestamp: Math.round((this.#request.info?.wallTime ?? 0) * 1000),
      // Contains isBlocked and intercepts
      ...interceptProps,
    };
  }

  #getResponseEventParams(): Network.ResponseData {
    // Chromium sends wrong extraInfo events for responses served from cache.
    // See https://github.com/puppeteer/puppeteer/issues/9965 and
    // https://crbug.com/1340398.
    if (this.#response.info?.fromDiskCache) {
      this.#response.extraInfo = undefined;
    }

    const headers = [
      ...bidiNetworkHeadersFromCdpNetworkHeaders(this.#response.info?.headers),
      ...bidiNetworkHeadersFromCdpNetworkHeaders(
        this.#response.extraInfo?.headers
      ),
      // TODO: Verify how to dedupe these
      // ...bidiNetworkHeadersFromCdpNetworkHeadersEntries(
      //   this.#response.paused?.responseHeaders
      // ),
    ];

    const authChallenges = this.#authChallenges;

    return {
      url: this.url,
      protocol: this.#response.info?.protocol ?? '',
      status: this.#statusCode ?? -1, // TODO: Throw an exception or use some other status code?
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
      ...(authChallenges ? {authChallenges} : {}),
      // @ts-expect-error this is a CDP-specific extension.
      'goog:securityDetails': this.#response.info?.securityDetails,
    };
  }

  #getRequestData(): Network.RequestData {
    const headers = this.#requestHeaders;

    return {
      request: this.#id,
      url: this.url,
      method: this.#method ?? NetworkRequest.unknownParameter,
      headers,
      cookies: this.#cookies,
      headersSize: computeHeadersSize(headers),
      bodySize: this.#bodySize,
      timings: this.#timings,
      // @ts-expect-error CDP-specific attribute.
      'goog:postData': this.#request.info?.request?.postData,
      'goog:hasPostData': this.#request.info?.request?.hasPostData,
      'goog:resourceType': this.#request.info?.type,
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
          columnNumber: this.#request.info.initiator.columnNumber,
          lineNumber: this.#request.info.initiator.lineNumber,
          stackTrace: this.#request.info.initiator.stack,
          request: this.#request.info.initiator.requestId,
        },
      },
    };
  }

  #getResponseStartedEvent(): Network.ResponseStarted {
    return {
      method: ChromiumBidi.Network.EventNames.ResponseStarted,
      params: {
        ...this.#getBaseEventParams(Network.InterceptPhase.ResponseStarted),
        response: this.#getResponseEventParams(),
      },
    };
  }

  #getResponseReceivedEvent(): Network.ResponseCompleted {
    return {
      method: ChromiumBidi.Network.EventNames.ResponseCompleted,
      params: {
        ...this.#getBaseEventParams(),
        response: this.#getResponseEventParams(),
      },
    };
  }

  #isIgnoredEvent(): boolean {
    const faviconUrl = '/favicon.ico';
    return (
      this.#request.paused?.request.url.endsWith(faviconUrl) ??
      this.#request.info?.request.url.endsWith(faviconUrl) ??
      false
    );
  }

  #getOverrideHeader(
    headers: Network.Header[] | undefined,
    cookies: Network.CookieHeader[] | undefined
  ): Network.Header[] | undefined {
    if (!headers && !cookies) {
      return [];
    }
    let overrideHeaders: Network.Header[] | undefined = headers;
    const cookieHeader = networkHeaderFromCookieHeaders(cookies);
    if (cookieHeader && !overrideHeaders) {
      overrideHeaders = this.#requestHeaders;
    }
    if (cookieHeader && overrideHeaders) {
      overrideHeaders.filter(
        (header) =>
          header.name.localeCompare('cookie', undefined, {
            sensitivity: 'base',
          }) !== 0
      );
      overrideHeaders.push(cookieHeader);
    }

    return overrideHeaders;
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
}

function getCdpBodyFromBiDiBytesValue(
  body?: Network.BytesValue
): string | undefined {
  let parsedBody: string | undefined;
  if (body?.type === 'string') {
    parsedBody = btoa(body.value);
  } else if (body?.type === 'base64') {
    parsedBody = body.value;
  }
  return parsedBody;
}

function getSizeFromBiDiBytesValue(body?: Network.BytesValue): number {
  if (body?.type === 'string') {
    return body.value.length;
  } else if (body?.type === 'base64') {
    return atob(body.value).length;
  }
  return 0;
}
