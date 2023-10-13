/**
 * Copyright 2021 Google LLC.
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
 * @license
 */

import {BidiServer} from '../bidiMapper/BidiMapper.js';
import {CdpConnection} from '../cdp/CdpConnection.js';
import {LogType} from '../utils/log.js';

import {BidiParser} from './BidiParser.js';
import {WindowBidiTransport, WindowCdpTransport} from './Transport.js';
import {generatePage, log} from './mapperTabPage.js';

declare global {
  interface Window {
    // `runMapper` function will be defined by the Mapper in the Tab, and will
    // be evaluated via `Runtime.evaluate` by the Node runner, providing all the
    // required parameters.
    runMapper: ((...args: any) => Promise<string>) | null;

    // `window.cdp` is exposed by `Target.exposeDevToolsProtocol` from the server side.
    // https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-exposeDevToolsProtocol
    cdp: {
      send: (message: string) => void;
      onmessage: ((message: string) => void) | null;
    };

    // `window.sendBidiResponse` is exposed by `Runtime.addBinding` from the server side.
    sendBidiResponse: (response: string) => void;

    // `window.onBidiMessage` is called via `Runtime.evaluate` from the server side.
    onBidiMessage: ((message: string) => void) | null;

    // Set from the server side if verbose logging is required.
    sendDebugMessage?: ((message: string) => void) | null;
  }
}

void (async () => {
  generatePage();
  const mapperTabToServerTransport = new WindowBidiTransport();
  const cdpTransport = new WindowCdpTransport();

  /**
   * Launches the BiDi mapper.
   * @param selfTargetId Needed to filter out info related to BiDi target.
   */
  window.runMapper = async (selfTargetId) => {
    console.log('launching with selfTargetId: ', selfTargetId);

    await BidiServer.createAndStart(
      mapperTabToServerTransport,
      /**
       * A CdpTransport implementation that uses the window.cdp bindings
       * injected by Target.exposeDevToolsProtocol.
       */
      new CdpConnection(cdpTransport, log),
      selfTargetId,
      new BidiParser(),
      log
    );

    log(LogType.debugInfo, 'Launched');

    return 'launched';
  };
})();
