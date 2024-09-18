/**
 * Copyright 2024 Google LLC.
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

/**
 * THIS FILE IS AUTOGENERATED by cddlconv 0.1.5.
 * Run `node tools/generate-bidi-types.mjs` to regenerate.
 * @see https://github.com/w3c/webdriver-bidi/blob/master/index.bs
 */

export namespace Bluetooth {
  export type RequestDevice = string;
}
export namespace Bluetooth {
  export type RequestDeviceInfo = {
    id: Bluetooth.RequestDevice;
    name: string | null;
  };
}
export namespace Bluetooth {
  export type RequestDevicePrompt = string;
  export type AdapterState = 'powered-on' | 'powered-off' | 'absent';
}
export namespace Bluetooth {
  export type HandleRequestDevicePrompt = {
    method: 'bluetooth.handleRequestDevicePrompt';
    params: Bluetooth.HandleRequestDevicePromptParameters;
  };
}
export namespace Bluetooth {
  export type SimulateAdapter = {
    method: 'bluetooth.simulateAdapter';
    params: Bluetooth.SimulateAdapterParameters;
  };
}
export namespace Bluetooth {
  export type SimulateAdapterParameters = {
    context: string;
    state: Bluetooth.AdapterState;
  };
}
export namespace Bluetooth {
  export type HandleRequestDevicePromptParameters = {
    context: string;
    prompt: Bluetooth.RequestDevicePrompt;
  } & (
    | Bluetooth.HandleRequestDevicePromptAcceptParameters
    | Bluetooth.HandleRequestDevicePromptCancelParameters
  );
}
export namespace Bluetooth {
  export type HandleRequestDevicePromptAcceptParameters = {
    accept: true;
    device: Bluetooth.RequestDevice;
  };
}
export namespace Bluetooth {
  export type HandleRequestDevicePromptCancelParameters = {
    accept: false;
  };
}
export namespace Bluetooth {
  export type RequestDevicePromptUpdated = {
    method: 'bluetooth.requestDevicePromptUpdated';
    params: Bluetooth.RequestDevicePromptUpdatedParameters;
  };
}
export namespace Bluetooth {
  export type RequestDevicePromptUpdatedParameters = {
    context: string;
    prompt: Bluetooth.RequestDevicePrompt;
    devices: [...Bluetooth.RequestDeviceInfo[]];
  };
}
