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

import type * as Cdp from './cdp.js';
import type * as WebDriverBidi from './generated/webdriver-bidi.js';

export type EventNames =
  // keep-sorted start
  | BiDiModule
  | BrowsingContext.EventNames
  | Cdp.EventNames
  | Log.EventNames
  | Network.EventNames
  | Script.EventNames;
// keep-sorted end

export enum BiDiModule {
  // keep-sorted start
  Browser = 'browser',
  BrowsingContext = 'browsingContext',
  Cdp = 'cdp',
  Input = 'input',
  Log = 'log',
  Network = 'network',
  Script = 'script',
  Session = 'session',
  // keep-sorted end
}

export namespace Script {
  export enum EventNames {
    // keep-sorted start
    Message = 'script.message',
    RealmCreated = 'script.realmCreated',
    RealmDestroyed = 'script.realmDestroyed',
    // keep-sorted end
  }
}

export namespace Log {
  export enum EventNames {
    LogEntryAdded = 'log.entryAdded',
  }
}

export namespace BrowsingContext {
  export enum EventNames {
    // keep-sorted start
    ContextCreated = 'browsingContext.contextCreated',
    ContextDestroyed = 'browsingContext.contextDestroyed',
    DomContentLoaded = 'browsingContext.domContentLoaded',
    DownloadWillBegin = 'browsingContext.downloadWillBegin',
    FragmentNavigated = 'browsingContext.fragmentNavigated',
    Load = 'browsingContext.load',
    NavigationAborted = 'browsingContext.navigationAborted',
    NavigationFailed = 'browsingContext.navigationFailed',
    NavigationStarted = 'browsingContext.navigationStarted',
    UserPromptClosed = 'browsingContext.userPromptClosed',
    UserPromptOpened = 'browsingContext.userPromptOpened',
    // keep-sorted end
  }
}

export namespace Network {
  export enum EventNames {
    // keep-sorted start
    AuthRequired = 'network.authRequired',
    BeforeRequestSent = 'network.beforeRequestSent',
    FetchError = 'network.fetchError',
    ResponseCompleted = 'network.responseCompleted',
    ResponseStarted = 'network.responseStarted',
    // keep-sorted end
  }
}

export type Command = (WebDriverBidi.Command | Cdp.Command) & {
  channel?: WebDriverBidi.Script.Channel;
};

export type CommandResponse =
  | WebDriverBidi.CommandResponse
  | Cdp.CommandResponse;

export type Event = WebDriverBidi.Event | Cdp.Event;

export const EVENT_NAMES = new Set([
  // keep-sorted start
  ...Object.values(BiDiModule),
  ...Object.values(BrowsingContext.EventNames),
  ...Object.values(Log.EventNames),
  ...Object.values(Network.EventNames),
  ...Object.values(Script.EventNames),
  // keep-sorted end
]);

export type ResultData = WebDriverBidi.ResultData | Cdp.ResultData;

export type Message = (
  | WebDriverBidi.Message
  | Cdp.Message
  | {launched: true}
) & {
  channel?: WebDriverBidi.Script.Channel;
};
