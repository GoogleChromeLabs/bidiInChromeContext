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

import {escapeHtml, groupTests} from './formatter.mjs';

describe('HTML WPT reporter', () => {
  it('should escapeHtml', () => {
    expect(escapeHtml('&<>\'"/')).to.equal('&amp;&lt;&gt;&#39;&quot;&#47;');
  });

  describe('groupTests', () => {
    it('should group tests', () => {
      let tests = groupTests([
        {
          message: null,
          path: '/a/b/c/d.py/sub_1',
          name: 'sub_1',
          status: 'PASS',
        },
        {
          message: 'some failure',
          path: '/a/b/c/d.py/sub_2',
          name: 'sub_2',
          status: 'FAIL',
        },
        {
          message: null,
          path: '/a/b/c/d.py/sub_3&amp;&lt;&gt;&#39;&quot;&#47;',
          name: 'sub_3&<>\'"/',
          status: 'PASS',
        },
        {
          message: null,
          path: '/a/b/c/e.py',
          name: null,
          status: 'PASS',
        },
        {
          message: null,
          name: null,
          path: '/a/f/g.py',
          status: 'TIMEOUT',
        },
      ]);

      expect(tests).to.deep.equal({
        message: null,
        path: '/a',
        name: null,
        status: null,
        stat: {
          all: 5,
          pass: 3,
        },
        children: [
          {
            message: null,
            path: '/a/b/c',
            name: null,
            status: null,
            stat: {
              all: 4,
              pass: 3,
            },
            children: [
              {
                message: null,
                path: '/a/b/c/d.py',
                name: null,
                status: null,
                stat: {
                  all: 3,
                  pass: 2,
                },
                children: [
                  {
                    message: null,
                    path: '/a/b/c/d.py/sub_1',
                    name: 'sub_1',
                    status: 'PASS',
                  },
                  {
                    message: 'some failure',
                    path: '/a/b/c/d.py/sub_2',
                    name: 'sub_2',
                    status: 'FAIL',
                  },
                  {
                    message: null,
                    path: '/a/b/c/d.py/sub_3&amp;&lt;&gt;&#39;&quot;&#47;',
                    name: 'sub_3&<>\'"/',
                    status: 'PASS',
                  },
                ],
              },
              {
                message: null,
                path: '/a/b/c/e.py',
                name: null,
                status: 'PASS',
              },
            ],
          },
          {
            message: null,
            path: '/a/f',
            name: null,
            status: null,
            stat: {
              all: 1,
              pass: 0,
            },
            children: [
              {
                message: null,
                name: null,
                path: '/a/f/g.py',
                status: 'TIMEOUT',
              },
            ],
          },
        ],
      });
    });
  });
});
