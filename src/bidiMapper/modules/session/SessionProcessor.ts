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

import type {CdpClient} from '../../../cdp/CdpClient.js';
import type {BidiPlusChannel} from '../../../protocol/chromium-bidi.js';
import {
  InvalidArgumentException,
  Session,
  type ChromiumBidi,
  type EmptyResult,
} from '../../../protocol/protocol.js';
import type {MapperOptions} from '../../BidiServer.js';

import type {EventManager} from './EventManager.js';

export class SessionProcessor {
  #eventManager: EventManager;
  #browserCdpClient: CdpClient;
  #initConnection: (opts: MapperOptions) => Promise<void>;
  #created = false;

  constructor(
    eventManager: EventManager,
    browserCdpClient: CdpClient,
    initConnection: (opts: MapperOptions) => Promise<void>,
  ) {
    this.#eventManager = eventManager;
    this.#browserCdpClient = browserCdpClient;
    this.#initConnection = initConnection;
  }

  status(): Session.StatusResult {
    return {ready: false, message: 'already connected'};
  }

  #mergeCapabilities(
    capabilitiesRequest: Session.CapabilitiesRequest,
  ): Session.CapabilityRequest {
    // Roughly following https://www.w3.org/TR/webdriver2/#dfn-capabilities-processing.
    // Validations should already be done by the parser.

    const mergedCapabilities = [];

    for (const first of capabilitiesRequest.firstMatch ?? [{}]) {
      const result = {
        ...capabilitiesRequest.alwaysMatch,
      };
      for (const key of Object.keys(first)) {
        if (result[key] !== undefined) {
          throw new InvalidArgumentException(
            `Capability ${key} in firstMatch is already defined in alwaysMatch`,
          );
        }
        result[key] = first[key];
      }

      mergedCapabilities.push(result);
    }

    const match =
      mergedCapabilities.find((c) => c.browserName === 'chrome') ??
      mergedCapabilities[0] ??
      {};

    match.unhandledPromptBehavior = this.#getUnhandledPromptBehavior(
      match.unhandledPromptBehavior,
    );

    return match;
  }

  #getUnhandledPromptBehavior(
    capabilityValue: unknown,
  ): Session.UserPromptHandler | undefined {
    if (capabilityValue === undefined) {
      return undefined;
    }
    if (typeof capabilityValue === 'object') {
      // Do not validate capabilities. Incorrect ones will be ignored by Mapper.
      return capabilityValue as Session.UserPromptHandler;
    }
    if (typeof capabilityValue !== 'string') {
      throw new InvalidArgumentException(
        `Unexpected 'unhandledPromptBehavior' type: ${typeof capabilityValue}`,
      );
    }
    switch (capabilityValue) {
      case 'accept':
      case 'accept and notify':
        return {default: Session.UserPromptHandlerType.Accept};
      case 'dismiss':
      case 'dismiss and notify':
        return {default: Session.UserPromptHandlerType.Dismiss};
      case 'ignore':
        return {default: Session.UserPromptHandlerType.Ignore};
      default:
        throw new InvalidArgumentException(
          `Unexpected 'unhandledPromptBehavior' value: ${capabilityValue}`,
        );
    }
  }

  async new(params: Session.NewParameters): Promise<Session.NewResult> {
    if (this.#created) {
      throw new Error('Session has been already created.');
    }
    this.#created = true;

    const matchedCapabitlites = this.#mergeCapabilities(params.capabilities);

    await this.#initConnection(matchedCapabitlites);

    const version =
      await this.#browserCdpClient.sendCommand('Browser.getVersion');

    return {
      sessionId: 'unknown',
      capabilities: {
        ...matchedCapabitlites,
        acceptInsecureCerts: matchedCapabitlites.acceptInsecureCerts ?? false,
        browserName: version.product,
        browserVersion: version.revision,
        platformName: '',
        setWindowRect: false,
        webSocketUrl: '',
        userAgent: version.userAgent,
      },
    };
  }

  async subscribe(
    params: Session.SubscriptionRequest,
    channel: BidiPlusChannel = null,
  ): Promise<EmptyResult> {
    await this.#eventManager.subscribe(
      params.events as ChromiumBidi.EventNames[],
      params.contexts ?? [null],
      channel,
    );
    return {};
  }

  async unsubscribe(
    params: Session.SubscriptionRequest,
    channel: BidiPlusChannel = null,
  ): Promise<EmptyResult> {
    await this.#eventManager.unsubscribe(
      params.events as ChromiumBidi.EventNames[],
      params.contexts ?? [null],
      channel,
    );
    return {};
  }
}
