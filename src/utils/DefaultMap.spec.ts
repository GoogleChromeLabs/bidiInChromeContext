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

import * as chai from 'chai';

import {DefaultMap} from './DefaultMap.js';

const expect = chai.expect;

describe.only('DefaultMap', () => {
  it('returns the default value when key does not exist', () => {
    const defaultValue = 42;

    const cutenessMap = new DefaultMap<string, number>(
      () => defaultValue,
      [['dog', 100]]
    );

    expect(cutenessMap.get('dog')).to.deep.equal(100);
    expect(cutenessMap.get('cat')).to.deep.equal(defaultValue);

    expect(Array.from(cutenessMap.keys())).to.deep.equal(['dog', 'cat']);
    expect(Array.from(cutenessMap.values())).to.deep.equal([100, defaultValue]);
  });

  it('sets and gets properly', () => {
    const cutenessMap = new DefaultMap<string, number>(() => 0);

    cutenessMap.set('cat', 50);
    expect(cutenessMap.get('cat')).to.deep.equal(50);

    expect(Array.from(cutenessMap.keys())).to.deep.equal(['cat']);
    expect(Array.from(cutenessMap.values())).to.deep.equal([50]);
  });
});
