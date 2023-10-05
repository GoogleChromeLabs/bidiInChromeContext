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
 */

/**
 * @fileoverview This file implements the Network domain processor which is
 * responsible for processing Network domain events and redirecting events to
 * related `NetworkRequest`.
 */
import type Protocol from 'devtools-protocol';

import {Network} from '../../../protocol/protocol.js';
import type {CdpTarget} from '../context/CdpTarget.js';

import {NetworkRequest} from './NetworkRequest.js';
import type {NetworkStorage} from './NetworkStorage.js';
import {
  computeResponseHeadersSize,
  bidiNetworkHeadersFromCdpFetchHeaderEntryArray,
} from './NetworkUtils.js';

/** Maps 1:1 to CdpTarget. */
export class NetworkManager {
  readonly #cdpTarget: CdpTarget;
  readonly #networkStorage: NetworkStorage;

  private constructor(cdpTarget: CdpTarget, networkStorage: NetworkStorage) {
    this.#cdpTarget = cdpTarget;
    this.#networkStorage = networkStorage;
  }

  /** Returns the CDP Target associated with this NetworkManager instance. */
  get cdpTarget(): CdpTarget {
    return this.#cdpTarget;
  }

  /**
   * Gets the network request with the given ID, if any.
   * Otherwise, creates a new network request with the given ID and cdp target.
   */
  #getOrCreateNetworkRequest(
    id: Network.Request,
    redirectCount?: number
  ): NetworkRequest {
    let request = this.#networkStorage.getRequest(id);
    if (request) {
      return request;
    }

    request = new NetworkRequest(
      id,
      this.#networkStorage.eventManager,
      this.#cdpTarget,
      redirectCount
    );

    this.#networkStorage.addRequest(request);

    return request;
  }

  static create(
    cdpTarget: CdpTarget,
    networkStorage: NetworkStorage
  ): NetworkManager {
    const networkManager = new NetworkManager(cdpTarget, networkStorage);

    cdpTarget.cdpClient
      .browserClient()
      .on(
        'Target.detachedFromTarget',
        (params: Protocol.Target.DetachedFromTargetEvent) => {
          if (cdpTarget.cdpClient.sessionId === params.sessionId) {
            networkManager.#networkStorage.disposeRequestMap();
          }
        }
      );

    cdpTarget.cdpClient.on(
      'Network.requestWillBeSent',
      (params: Protocol.Network.RequestWillBeSentEvent) => {
        const request = networkManager.#networkStorage.getRequest(
          params.requestId
        );
        if (request && request.isRedirecting()) {
          request.handleRedirect(params);
          networkManager.#networkStorage.deleteRequest(params.requestId);
          networkManager
            .#getOrCreateNetworkRequest(
              params.requestId,
              request.redirectCount + 1
            )
            .onRequestWillBeSentEvent(params);
        } else if (request) {
          request.onRequestWillBeSentEvent(params);
        } else {
          networkManager
            .#getOrCreateNetworkRequest(params.requestId)
            .onRequestWillBeSentEvent(params);
        }
      }
    );

    cdpTarget.cdpClient.on(
      'Network.requestWillBeSentExtraInfo',
      (params: Protocol.Network.RequestWillBeSentExtraInfoEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onRequestWillBeSentExtraInfoEvent(params);
      }
    );

    cdpTarget.cdpClient.on(
      'Network.responseReceived',
      (params: Protocol.Network.ResponseReceivedEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onResponseReceivedEvent(params);
      }
    );

    cdpTarget.cdpClient.on(
      'Network.responseReceivedExtraInfo',
      (params: Protocol.Network.ResponseReceivedExtraInfoEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onResponseReceivedExtraInfoEvent(params);
      }
    );

    cdpTarget.cdpClient.on(
      'Network.requestServedFromCache',
      (params: Protocol.Network.RequestServedFromCacheEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onServedFromCache();
      }
    );

    cdpTarget.cdpClient.on(
      'Network.loadingFailed',
      (params: Protocol.Network.LoadingFailedEvent) => {
        networkManager
          .#getOrCreateNetworkRequest(params.requestId)
          .onLoadingFailedEvent(params);
      }
    );

    // https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#event-requestPaused
    cdpTarget.cdpClient.on(
      'Fetch.requestPaused',
      (params: Protocol.Fetch.RequestPausedEvent) => {
        if (params.networkId) {
          // The stage of the request can be determined by presence of
          // responseErrorReason and responseStatusCode -- the request is at
          // the response stage if either of these fields is present and in the
          // request stage otherwise.
          // TODO: Populate the "authRequired" phase.
          let phase: Network.InterceptPhase;
          if (
            params.responseErrorReason === undefined &&
            params.responseStatusCode === undefined
          ) {
            phase = Network.InterceptPhase.BeforeRequestSent;
          } else if (params.responseStatusCode === 401) {
            // TODO: Write a test for this phase.
            // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
            phase = Network.InterceptPhase.AuthRequired;
          } else {
            phase = Network.InterceptPhase.ResponseStarted;
          }

          const headers = bidiNetworkHeadersFromCdpFetchHeaderEntryArray(
            // TODO: Use params.request.headers if request?
            params.responseHeaders
          );

          networkManager.#networkStorage.addBlockedRequest(params.networkId, {
            request: params.requestId, // intercept request id
            phase,
            // TODO: Finish populate response / ResponseData.
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
          networkManager
            .#getOrCreateNetworkRequest(params.networkId)
            .onRequestPaused(params);
        }
      }
    );

    return networkManager;
  }
}
