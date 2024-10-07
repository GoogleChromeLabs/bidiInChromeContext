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
import {expect} from 'chai';
import type {Protocol} from 'devtools-protocol';

import type {Network} from '../../../protocol/protocol.js';

import * as networkUtils from './NetworkUtils.js';

describe('NetworkUtils', () => {
  describe('should compute response headers size', () => {
    it('empty', () => {
      const headers: Network.Header[] = [];
      const responseHeadersSize = networkUtils.computeHeadersSize(headers);

      expect(responseHeadersSize).to.equal(0);
    });

    it('non-empty', () => {
      const headers: Network.Header[] = [
        {
          name: 'Content-Type',
          value: {
            type: 'string',
            value: 'text/html',
          },
        },
        {
          name: 'Content-Length',
          value: {
            type: 'string',
            value: '123',
          },
        },
      ];
      const responseHeadersSize = networkUtils.computeHeadersSize(headers);

      expect(responseHeadersSize).to.equal(46);
    });
  });

  describe('should convert CDP network headers to Bidi network headers', () => {
    it('empty', () => {
      const cdpNetworkHeaders = {};
      const bidiNetworkHeaders =
        networkUtils.bidiNetworkHeadersFromCdpNetworkHeaders(cdpNetworkHeaders);

      expect(bidiNetworkHeaders).to.deep.equal([]);
    });

    it('non-empty', () => {
      const cdpNetworkHeaders = {
        'Content-Type': 'text/html',
        'Content-Length': '123',
      };
      const bidiNetworkHeaders =
        networkUtils.bidiNetworkHeadersFromCdpNetworkHeaders(cdpNetworkHeaders);

      expect(bidiNetworkHeaders).to.deep.equal([
        {
          name: 'Content-Type',
          value: {
            type: 'string',
            value: 'text/html',
          },
        },
        {
          name: 'Content-Length',
          value: {
            type: 'string',
            value: '123',
          },
        },
      ]);
    });
  });

  describe('matchUrlPattern', () => {
    it('works', () => {
      networkUtils.matchUrlPattern(
        {
          type: 'string',
          pattern:
            'https://web-platform.test:8443/webdriver/tests/support/inline.py?doc=%3C%21doctype+html%3E%0A%3Cmeta+charset%3DUTF-8%3E%0A%3Cdiv+id%3D%27from-initial%27%3Einitial%3C%2Fdiv%3E&mime=text%2Fhtml&charset=UTF-8',
        },
        'https://web-platform.test:8443/webdriver/tests/support/inline.py?doc=%3C%21doctype+html%3E%0A%3Cmeta+charset%3DUTF-8%3E%0A%3Cdiv+id%3D%27from-initial%27%3Einitial%3C%2Fdiv%3E&mime=text%2Fhtml&charset=UTF-8'
      );
    });
  });

  describe('should convert Bidi network headers to CDP network headers', () => {
    it('undefined', () => {
      const cdpNetworkHeaders =
        networkUtils.cdpNetworkHeadersFromBidiNetworkHeaders(undefined);

      expect(cdpNetworkHeaders).to.equal(undefined);
    });

    it('empty', () => {
      const bidiNetworkHeaders: Network.Header[] = [];
      const cdpNetworkHeaders =
        networkUtils.cdpNetworkHeadersFromBidiNetworkHeaders(
          bidiNetworkHeaders
        );

      expect(cdpNetworkHeaders).to.deep.equal({});
    });

    it('non-empty', () => {
      const bidiNetworkHeaders: Network.Header[] = [
        {
          name: 'Content-Type',
          value: {
            type: 'string',
            value: 'text/html',
          },
        },
        {
          name: 'Content-Length',
          value: {
            type: 'string',
            value: '123',
          },
        },
      ];
      const cdpNetworkHeaders =
        networkUtils.cdpNetworkHeadersFromBidiNetworkHeaders(
          bidiNetworkHeaders
        );

      expect(cdpNetworkHeaders).to.deep.equal({
        'Content-Type': 'text/html',
        'Content-Length': '123',
      });
    });
  });

  describe('should convert CDP fetch header entry array to Bidi network headers', () => {
    it('empty', () => {
      const cdpFetchHeaderEntryArray: Protocol.Fetch.HeaderEntry[] = [];
      const bidiNetworkHeaders =
        networkUtils.bidiNetworkHeadersFromCdpFetchHeaders(
          cdpFetchHeaderEntryArray
        );

      expect(bidiNetworkHeaders).to.deep.equal([]);
    });

    it('non-empty', () => {
      const cdpFetchHeaderEntryArray: Protocol.Fetch.HeaderEntry[] = [
        {
          name: 'Content-Type',
          value: 'text/html',
        },
        {
          name: 'Content-Length',
          value: '123',
        },
      ];
      const bidiNetworkHeaders =
        networkUtils.bidiNetworkHeadersFromCdpFetchHeaders(
          cdpFetchHeaderEntryArray
        );

      expect(bidiNetworkHeaders).to.deep.equal([
        {
          name: 'Content-Type',
          value: {
            type: 'string',
            value: 'text/html',
          },
        },
        {
          name: 'Content-Length',
          value: {
            type: 'string',
            value: '123',
          },
        },
      ]);
    });
  });

  describe('should convert Bidi network headers to CDP fetch header entry array', () => {
    it('undefined', () => {
      const cdpFetchHeaderEntryArray =
        networkUtils.cdpFetchHeadersFromBidiNetworkHeaders(undefined);

      expect(cdpFetchHeaderEntryArray).to.equal(undefined);
    });

    it('empty', () => {
      const bidiNetworkHeaders: Network.Header[] = [];
      const cdpFetchHeaderEntryArray =
        networkUtils.cdpFetchHeadersFromBidiNetworkHeaders(bidiNetworkHeaders);

      expect(cdpFetchHeaderEntryArray).to.deep.equal([]);
    });

    it('non-empty', () => {
      const bidiNetworkHeaders: Network.Header[] = [
        {
          name: 'Content-Type',
          value: {
            type: 'string',
            value: 'text/html',
          },
        },
        {
          name: 'Content-Length',
          value: {
            type: 'string',
            value: '123',
          },
        },
      ];
      const cdpFetchHeaderEntryArray =
        networkUtils.cdpFetchHeadersFromBidiNetworkHeaders(bidiNetworkHeaders);

      expect(cdpFetchHeaderEntryArray).to.deep.equal([
        {
          name: 'Content-Type',
          value: 'text/html',
        },
        {
          name: 'Content-Length',
          value: '123',
        },
      ]);
    });
  });

  describe('getTimings', () => {
    it('should work with undefined', () => {
      expect(networkUtils.getTiming(undefined)).to.equal(0);
    });

    it('should work with negative numbers', () => {
      expect(networkUtils.getTiming(-1)).to.equal(0);
    });

    it('should work with ints', () => {
      expect(networkUtils.getTiming(1)).to.equal(1);
    });
  });
});
