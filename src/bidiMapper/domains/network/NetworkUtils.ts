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
 * @fileoverview Utility functions for the Network domain.
 */
import type {Protocol} from 'devtools-protocol';

import {
  InvalidArgumentException,
  UnsupportedOperationException,
} from '../../../protocol/ErrorResponse';
import {Network, type Storage} from '../../../protocol/protocol.js';

export function computeHeadersSize(headers: Network.Header[]): number {
  const requestHeaders = headers.reduce((acc, header) => {
    return `${acc}${header.name}: ${header.value.value}\r\n`;
  }, '');

  return new TextEncoder().encode(requestHeaders).length;
}

/** Converts from CDP Network domain headers to Bidi network headers. */
export function bidiNetworkHeadersFromCdpNetworkHeaders(
  headers?: Protocol.Network.Headers
): Network.Header[] {
  if (!headers) {
    return [];
  }

  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: {
      type: 'string',
      value,
    },
  }));
}

/** Converts from Bidi network headers to CDP Network domain headers. */
export function cdpNetworkHeadersFromBidiNetworkHeaders(
  headers?: Network.Header[]
): Protocol.Network.Headers | undefined {
  if (headers === undefined) {
    return undefined;
  }

  return headers.reduce((result, header) => {
    // TODO: Distinguish between string and bytes?
    result[header.name] = header.value.value;
    return result;
  }, {} as Protocol.Network.Headers);
}

/** Converts from CDP Fetch domain header entries to Bidi network headers. */
export function bidiNetworkHeadersFromCdpFetchHeaders(
  headers?: Protocol.Fetch.HeaderEntry[]
): Network.Header[] {
  if (!headers) {
    return [];
  }

  return headers.map(({name, value}) => ({
    name,
    value: {
      type: 'string',
      value,
    },
  }));
}

/** Converts from Bidi network headers to CDP Fetch domain header entries. */
export function cdpFetchHeadersFromBidiNetworkHeaders(
  headers?: Network.Header[]
): Protocol.Fetch.HeaderEntry[] | undefined {
  if (headers === undefined) {
    return undefined;
  }

  return headers.map(({name, value}) => ({
    name,
    value: value.value,
  }));
}

/** Converts from Bidi auth action to CDP auth challenge response. */
export function cdpAuthChallengeResponseFromBidiAuthContinueWithAuthAction(
  action: 'default' | 'cancel' | 'provideCredentials'
) {
  switch (action) {
    case 'default':
      return 'Default';
    case 'cancel':
      return 'CancelAuth';
    case 'provideCredentials':
      return 'ProvideCredentials';
  }
}

/**
 * Converts from CDP Network domain cookie to BiDi network cookie.
 * * https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-Cookie
 * * https://w3c.github.io/webdriver-bidi/#type-network-Cookie
 */
export function cdpToBiDiCookie(
  cookie: Protocol.Network.Cookie
): Network.Cookie {
  const result: Network.Cookie = {
    name: cookie.name,
    value: {type: 'string', value: cookie.value},
    domain: cookie.domain,
    path: cookie.path,
    size: cookie.size,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite:
      cookie.sameSite === undefined
        ? Network.SameSite.None
        : sameSiteCdpToBiDi(cookie.sameSite),
    ...(cookie.expires >= 0 ? {expiry: cookie.expires} : undefined),
  };

  // Extending with CDP-specific properties with `goog:` prefix.
  result[`goog:session`] = cookie.session;
  result[`goog:priority`] = cookie.priority;
  result[`goog:sameParty`] = cookie.sameParty;
  result[`goog:sourceScheme`] = cookie.sourceScheme;
  result[`goog:sourcePort`] = cookie.sourcePort;
  if (cookie.partitionKey !== undefined) {
    result[`goog:partitionKey`] = cookie.partitionKey;
  }
  if (cookie.partitionKeyOpaque !== undefined) {
    result[`goog:partitionKeyOpaque`] = cookie.partitionKeyOpaque;
  }
  return result;
}

/**
 * Converts from BiDi set network cookie params to CDP Network domain cookie.
 * * https://w3c.github.io/webdriver-bidi/#type-network-Cookie
 * * https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-CookieParam
 */
export function bidiToCdpCookie(
  params: Storage.SetCookieParameters,
  partitionKey: Storage.PartitionKey
): Protocol.Network.CookieParam {
  if (params.cookie.value.type !== 'string') {
    // CDP supports only string values in cookies.
    throw new UnsupportedOperationException(
      'Only string cookie values are supported'
    );
  }
  const deserializedValue = params.cookie.value.value;
  const result: Protocol.Network.CookieParam = {
    name: params.cookie.name,
    value: deserializedValue,
    domain: params.cookie.domain,
    path: params.cookie.path ?? '/',
    secure: params.cookie.secure ?? false,
    httpOnly: params.cookie.httpOnly ?? false,
    // CDP's `partitionKey` is the BiDi's `partition.sourceOrigin`.
    ...(partitionKey.sourceOrigin !== undefined && {
      partitionKey: partitionKey.sourceOrigin,
    }),
    ...(params.cookie.expiry !== undefined && {
      expires: params.cookie.expiry,
    }),
    ...(params.cookie.sameSite !== undefined && {
      sameSite: sameSiteBiDiToCdp(params.cookie.sameSite),
    }),
  };

  // Extending with CDP-specific properties with `goog:` prefix.
  if (params.cookie[`goog:url`] !== undefined) {
    result.url = params.cookie[`goog:url`];
  }
  if (params.cookie[`goog:priority`] !== undefined) {
    result.priority = params.cookie[`goog:priority`];
  }
  if (params.cookie[`goog:sameParty`] !== undefined) {
    result.sameParty = params.cookie[`goog:sameParty`];
  }
  if (params.cookie[`goog:sourceScheme`] !== undefined) {
    result.sourceScheme = params.cookie[`goog:sourceScheme`];
  }
  if (params.cookie[`goog:sourcePort`] !== undefined) {
    result.sourcePort = params.cookie[`goog:sourcePort`];
  }

  return result;
}

function sameSiteCdpToBiDi(
  sameSite: Protocol.Network.CookieSameSite
): Network.SameSite {
  switch (sameSite) {
    case 'Strict':
      return Network.SameSite.Strict;
    case 'None':
      return Network.SameSite.None;
    case 'Lax':
      return Network.SameSite.Lax;
    default:
      // Defaults to `Lax`:
      // https://web.dev/articles/samesite-cookies-explained#samesitelax_by_default
      return Network.SameSite.Lax;
  }
}

function sameSiteBiDiToCdp(
  sameSite: Network.SameSite
): Protocol.Network.CookieSameSite {
  switch (sameSite) {
    case Network.SameSite.Strict:
      return 'Strict';
    case Network.SameSite.Lax:
      return 'Lax';
    case Network.SameSite.None:
      return 'None';
  }
  throw new InvalidArgumentException(`Unknown 'sameSite' value ${sameSite}`);
}
