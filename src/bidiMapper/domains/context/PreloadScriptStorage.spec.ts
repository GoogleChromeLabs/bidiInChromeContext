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

import * as uuid from '../../../utils/uuid.js';
import {Script} from '../../../protocol/protocol.js';

import {CdpTarget} from './cdpTarget';
import {PreloadScriptStorage, CdpPreloadScript} from './PreloadScriptStorage';

const MOCKED_UUID_1 = '00000000-0000-0000-0000-00000000000a';
const MOCKED_UUID_2 = '00000000-0000-0000-0000-00000000000b';

describe('PreloadScriptStorage', () => {
  let preloadScriptStorage: PreloadScriptStorage;

  let functionDeclaration: string;
  let channels: Script.ChannelValue[] | undefined;
  let sandbox: string;
  let exposedId: string;

  let uuidStub: sinon.SinonStub;

  let cdpTarget: sinon.SinonStubbedInstance<CdpTarget>;
  let cdpTargetId: string;
  let cdpPreloadScript1: CdpPreloadScript;
  let cdpPreloadScript2: CdpPreloadScript;

  beforeEach(() => {
    preloadScriptStorage = new PreloadScriptStorage();

    functionDeclaration = '() => {}';
    channels = [];
    sandbox = 'MY_SANDBOX';
    exposedId = 'EXPOSED_ID';
    cdpTargetId = 'TARGET_ID';

    uuidStub = sinon
      .stub(uuid, 'uuidv4')
      .onFirstCall()
      .returns(MOCKED_UUID_1)
      .onSecondCall()
      .returns(MOCKED_UUID_2);

    cdpTarget = sinon.createStubInstance(CdpTarget);
    sinon.stub(cdpTarget, 'targetId').get(() => cdpTargetId);

    cdpPreloadScript1 = {
      target: cdpTarget,
      preloadScriptId: 'PRELOAD_SCRIPT_1',
    };
    cdpPreloadScript2 = {
      target: cdpTarget,
      preloadScriptId: 'PRELOAD_SCRIPT_2',
    };
  });

  it('initial state', () => {
    expect(preloadScriptStorage.findPreloadScripts()).to.be.empty;
    expect(preloadScriptStorage.findPreloadScripts({})).to.be.empty;
    expect(
      preloadScriptStorage.findPreloadScripts({
        id: '',
      })
    ).to.be.empty;
    expect(
      preloadScriptStorage.findPreloadScripts({
        contextId: null,
      })
    ).to.be.empty;
    expect(
      preloadScriptStorage.findPreloadScripts({
        contextId: '',
      })
    ).to.be.empty;
  });

  [
    {contextDescription: 'global context', context: null},
    {contextDescription: 'non-global context', context: 'CONTEXT_1'},
  ].forEach(({contextDescription, context}) => {
    it(`add preload scripts in ${contextDescription}`, () => {
      preloadScriptStorage.addPreloadScripts(
        exposedId,
        context,
        [cdpPreloadScript1, cdpPreloadScript2],
        functionDeclaration,
        channels,
        sandbox
      );

      expect(
        preloadScriptStorage.findPreloadScripts({contextId: context})
      ).to.deep.equal([
        {
          id: MOCKED_UUID_1,
          cdpPreloadScripts: [cdpPreloadScript1, cdpPreloadScript2],
          contextId: context,
          functionDeclaration,
          exposedId,
          channels,
          sandbox,
        },
      ]);

      expect(uuidStub.calledOnceWithExactly()).to.be.true;
    });

    it(`append cdp preload script in ${contextDescription}`, () => {
      preloadScriptStorage.addPreloadScripts(
        exposedId,
        context,
        [cdpPreloadScript1],
        functionDeclaration,
        channels,
        sandbox
      );

      const preloadScript = preloadScriptStorage.findPreloadScripts({
        contextId: context,
      })[0]!;

      preloadScriptStorage.appendCdpPreloadScript(
        preloadScript,
        cdpPreloadScript2
      );

      expect(
        preloadScriptStorage.findPreloadScripts({contextId: context})
      ).to.be.deep.equal([
        {
          id: MOCKED_UUID_1,
          cdpPreloadScripts: [cdpPreloadScript1, cdpPreloadScript2],
          contextId: context,
          exposedId,
          functionDeclaration,
          channels,
          sandbox,
        },
      ]);
    });

    it(`remove cdp preload script in ${contextDescription}`, () => {
      preloadScriptStorage.addPreloadScripts(
        exposedId,
        context,
        [cdpPreloadScript1],
        functionDeclaration,
        channels,
        sandbox
      );

      preloadScriptStorage.removeCdpPreloadScripts({
        targetId: cdpTargetId,
      });

      expect(
        preloadScriptStorage.findPreloadScripts({contextId: context})
      ).to.be.deep.equal([
        {
          id: MOCKED_UUID_1,
          cdpPreloadScripts: [],
          exposedId,
          functionDeclaration,
          channels,
          sandbox,
          contextId: context,
        },
      ]);
    });

    it(`remove non-existing BiDi id in ${contextDescription}`, () => {
      preloadScriptStorage.addPreloadScripts(
        exposedId,
        context,
        [cdpPreloadScript1, cdpPreloadScript2],
        functionDeclaration,
        channels,
        sandbox
      );

      const preloadScripts = preloadScriptStorage.findPreloadScripts({
        contextId: context,
      });

      preloadScriptStorage.removeBiDiPreloadScripts({
        contextId: context,
        id: `${MOCKED_UUID_1}_NON_EXISTING`,
      });

      expect(
        preloadScriptStorage.findPreloadScripts({contextId: context})
      ).to.be.deep.equal(preloadScripts);
    });

    [
      {filterDescription: 'context id', filter: {contextId: null}},
      {filterDescription: 'context ids', filter: {contextIds: [null]}},
      {
        filterDescription: 'bidi id',
        filter: {id: MOCKED_UUID_1},
      },
    ].forEach(({filterDescription, filter}) => {
      it(`find preload scripts in ${contextDescription} by ${filterDescription}`, () => {
        preloadScriptStorage.addPreloadScripts(
          exposedId,
          null,
          [cdpPreloadScript1],
          functionDeclaration,
          channels,
          sandbox
        );

        expect(preloadScriptStorage.findPreloadScripts(filter)).to.deep.equal([
          {
            id: MOCKED_UUID_1,
            cdpPreloadScripts: [cdpPreloadScript1],
            exposedId,
            contextId: null,
            functionDeclaration,
            channels,
            sandbox,
          },
        ]);
      });

      it(`remove preload scripts by in ${contextDescription} by ${filterDescription}`, () => {
        preloadScriptStorage.addPreloadScripts(
          exposedId,
          null,
          [cdpPreloadScript1],
          functionDeclaration,
          channels,
          sandbox
        );
        preloadScriptStorage.removeBiDiPreloadScripts(filter);

        expect(preloadScriptStorage.findPreloadScripts(filter)).to.be.empty;
      });
    });
  });

  afterEach(() => {
    sinon.restore();
  });
});
