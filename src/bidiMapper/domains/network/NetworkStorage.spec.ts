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
import {expect} from 'chai';
import * as sinon from 'sinon';

import {Network} from '../../../protocol/protocol.js';
import {EventManager} from '../events/EventManager.js';

import {NetworkStorage} from './NetworkStorage.js';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;

describe('NetworkStorage', () => {
  let eventManager: sinon.SinonStubbedInstance<EventManager>;
  let networkStorage: NetworkStorage;

  beforeEach(() => {
    eventManager = sinon.createStubInstance(EventManager);
    networkStorage = new NetworkStorage(eventManager);
  });

  it('disposeRequestMap', () => {
    networkStorage.disposeRequestMap();

    expect(networkStorage.requestMap).to.be.empty;
  });

  it('requestStageFromPhase', () => {
    expect(
      NetworkStorage.requestStageFromPhase(
        Network.InterceptPhase.BeforeRequestSent
      )
    ).to.equal('Request');
    expect(
      NetworkStorage.requestStageFromPhase(
        Network.InterceptPhase.ResponseStarted
      )
    ).to.equal('Response');
    expect(() =>
      NetworkStorage.requestStageFromPhase(Network.InterceptPhase.AuthRequired)
    ).to.throw();
  });

  describe('add intercept', () => {
    it('once', () => {
      const intercept = networkStorage.addIntercept({
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.com',
          },
        ],
        phases: [Network.InterceptPhase.BeforeRequestSent],
      });

      expect(intercept).to.match(UUID_REGEX);
      expect(networkStorage.getFetchEnableParams().patterns).to.have.lengthOf(
        1
      );
    });

    it('twice', () => {
      const intercept1 = networkStorage.addIntercept({
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.com',
          },
        ],
        phases: [Network.InterceptPhase.BeforeRequestSent],
      });
      const intercept2 = networkStorage.addIntercept({
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.org',
          },
        ],
        phases: [Network.InterceptPhase.BeforeRequestSent],
      });

      expect(intercept1).to.match(UUID_REGEX);
      expect(intercept2).to.match(UUID_REGEX);
      expect(intercept1).not.to.be.equal(intercept2);

      expect(networkStorage.getFetchEnableParams().patterns).to.have.lengthOf(
        2
      );
    });
  });

  it('remove intercept', () => {
    const intercept = networkStorage.addIntercept({
      urlPatterns: [
        {
          type: 'string',
          pattern: 'http://example.com',
        },
      ],
      phases: [Network.InterceptPhase.BeforeRequestSent],
    });
    networkStorage.removeIntercept(intercept);

    expect(networkStorage.getFetchEnableParams()).to.deep.equal({
      handleAuthRequests: false,
      patterns: [],
    });
  });

  describe('getFetchEnableParams', () => {
    it('no intercepts', () => {
      expect(networkStorage.getFetchEnableParams()).to.deep.equal({
        handleAuthRequests: false,
        patterns: [],
      });
    });

    [
      {
        description: 'one url pattern',
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.com',
          } satisfies Network.UrlPattern,
        ],
        phases: [Network.InterceptPhase.BeforeRequestSent],
        expected: {
          handleAuthRequests: false,
          patterns: [
            {
              requestStage: 'Request',
              urlPattern: 'http://example.com',
            },
          ],
        },
      },
      {
        description: 'two url patterns',
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.com',
          } satisfies Network.UrlPattern,
          {
            type: 'string',
            pattern: 'http://example.org',
          } satisfies Network.UrlPattern,
        ],
        phases: [Network.InterceptPhase.ResponseStarted],
        expected: {
          handleAuthRequests: false,
          patterns: [
            {
              requestStage: 'Response',
              urlPattern: 'http://example.com',
            },
            {
              requestStage: 'Response',
              urlPattern: 'http://example.org',
            },
          ],
        },
      },
      {
        description: 'auth required phase',
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.org',
          } satisfies Network.UrlPattern,
        ],
        phases: [Network.InterceptPhase.AuthRequired],
        expected: {
          handleAuthRequests: true,
          patterns: [
            {
              urlPattern: 'http://example.org',
            },
          ],
        },
      },
      {
        description: 'auth required and request phases',
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.org',
          } satisfies Network.UrlPattern,
        ],
        phases: [
          Network.InterceptPhase.AuthRequired,
          Network.InterceptPhase.BeforeRequestSent,
        ],
        expected: {
          handleAuthRequests: true,
          patterns: [
            {
              urlPattern: 'http://example.org',
            },
            {
              requestStage: 'Request',
              urlPattern: 'http://example.org',
            },
          ],
        },
      },
      {
        description: 'two phases',
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.com',
          } satisfies Network.UrlPattern,
        ],
        phases: [
          Network.InterceptPhase.BeforeRequestSent,
          Network.InterceptPhase.ResponseStarted,
        ],
        expected: {
          handleAuthRequests: false,
          patterns: [
            {
              requestStage: 'Request',
              urlPattern: 'http://example.com',
            },
            {
              requestStage: 'Response',
              urlPattern: 'http://example.com',
            },
          ],
        },
      },
      {
        description: 'two patterns, two phases',
        urlPatterns: [
          {
            type: 'string',
            pattern: 'http://example.com',
          } satisfies Network.UrlPattern,
          {
            type: 'string',
            pattern: 'http://example.org',
          } satisfies Network.UrlPattern,
        ],
        phases: [
          Network.InterceptPhase.BeforeRequestSent,
          Network.InterceptPhase.ResponseStarted,
        ],
        expected: {
          handleAuthRequests: false,
          patterns: [
            {
              requestStage: 'Request',
              urlPattern: 'http://example.com',
            },
            {
              requestStage: 'Response',
              urlPattern: 'http://example.com',
            },
            {
              requestStage: 'Request',
              urlPattern: 'http://example.org',
            },
            {
              requestStage: 'Response',
              urlPattern: 'http://example.org',
            },
          ],
        },
      },
    ].forEach(({description, urlPatterns, phases, expected}) => {
      it(description, () => {
        networkStorage.addIntercept({
          urlPatterns,
          phases,
        });

        expect(networkStorage.getFetchEnableParams()).to.deep.equal(expected);
      });
    });
  });

  describe('cdpFromSpecUrlPattern', () => {
    it('string type', () => {
      expect(
        NetworkStorage.cdpFromSpecUrlPattern({
          type: 'string',
          pattern: 'https://example.com',
        } satisfies Network.UrlPattern)
      ).to.equal('https://example.com');
    });

    it('pattern type', () => {
      expect(
        NetworkStorage.cdpFromSpecUrlPattern({
          type: 'pattern',
          protocol: 'https',
          hostname: 'example.com',
          port: '80',
          pathname: '/foo',
          search: 'bar=baz',
        } satisfies Network.UrlPattern)
      ).to.equal('https://example.com:80/foo?bar=baz');
    });
  });
});

// TODO: add test with UrlPatternPattern
// TODO: add test for buildUrlPatternString
