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
import type {Network, EmptyResult} from '../../../protocol/protocol.js';

export class NetworkProcessor {
  /** A map to define the properties of active network intercepts. */
  // #interceptMap = new Map<
  //   Network.Intercept,
  //   {
  //     urlPattern: string;
  //     interceptPhase: Network.InterceptPhase;
  //   }
  // >();

  /** A map to track the requests which are actively being blocked. */
  // #blockedRequestMap = new Map<
  //   Network.Request,
  //   {
  //     request: Network.Request;
  //     interceptPhase: Network.InterceptPhase;
  //     response: Network.ResponseData;
  //   }
  // >();

  process_network_addIntercept(
    _params: Network.AddInterceptParameters
  ): Network.AddInterceptResult {
    return {
      // TODO: populate.
      intercept: '',
    };
  }

  process_network_continueRequest(
    _params: Network.ContinueRequestParameters
  ): EmptyResult {
    return {};
  }

  process_network_continueResponse(
    _params: Network.ContinueResponseParameters
  ): EmptyResult {
    return {};
  }

  process_network_continueWithAuth(
    _params: Network.ContinueWithAuthParameters
  ): EmptyResult {
    return {};
  }

  process_network_failRequest(
    _params: Network.FailRequestParameters
  ): EmptyResult {
    return {};
  }

  process_network_provideResponse(
    _params: Network.ProvideResponseParameters
  ): EmptyResult {
    return {};
  }

  process_network_removeIntercept(
    _params: Network.RemoveInterceptParameters
  ): EmptyResult {
    return {};
  }
}
