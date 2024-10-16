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

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck Some types may be circular.

import z from 'zod';

export namespace Bluetooth {
  export const BluetoothServiceUuidSchema = z.lazy(() => z.string());
}
export namespace Bluetooth {
  export const BluetoothManufacturerDataSchema = z.lazy(() =>
    z.object({
      key: z.number().int().nonnegative(),
      data: z.string(),
    }),
  );
}
export namespace Bluetooth {
  export const RequestDeviceSchema = z.lazy(() => z.string());
}
export namespace Bluetooth {
  export const RequestDeviceInfoSchema = z.lazy(() =>
    z.object({
      id: Bluetooth.RequestDeviceSchema,
      name: z.union([z.string(), z.null()]),
    }),
  );
}
export namespace Bluetooth {
  export const RequestDevicePromptSchema = z.lazy(() => z.string());
}
export namespace Bluetooth {
  export const ScanRecordSchema = z.lazy(() =>
    z.object({
      name: z.string().optional(),
      uuids: z.array(Bluetooth.BluetoothServiceUuidSchema).optional(),
      appearance: z.number().optional(),
      manufacturerData: z
        .array(Bluetooth.BluetoothManufacturerDataSchema)
        .optional(),
    }),
  );
}
export namespace Bluetooth {
  export const HandleRequestDevicePromptSchema = z.lazy(() =>
    z.object({
      method: z.literal('bluetooth.handleRequestDevicePrompt'),
      params: Bluetooth.HandleRequestDevicePromptParametersSchema,
    }),
  );
}
export namespace Bluetooth {
  export const HandleRequestDevicePromptParametersSchema = z.lazy(() =>
    z
      .object({
        context: z.string(),
        prompt: Bluetooth.RequestDevicePromptSchema,
      })
      .and(
        z.union([
          Bluetooth.HandleRequestDevicePromptAcceptParametersSchema,
          Bluetooth.HandleRequestDevicePromptCancelParametersSchema,
        ]),
      ),
  );
}
export namespace Bluetooth {
  export const HandleRequestDevicePromptAcceptParametersSchema = z.lazy(() =>
    z.object({
      accept: z.literal(true),
      device: Bluetooth.RequestDeviceSchema,
    }),
  );
}
export namespace Bluetooth {
  export const HandleRequestDevicePromptCancelParametersSchema = z.lazy(() =>
    z.object({
      accept: z.literal(false),
    }),
  );
}
export namespace Bluetooth {
  export const SimulateAdapterSchema = z.lazy(() =>
    z.object({
      method: z.literal('bluetooth.simulateAdapter'),
      params: Bluetooth.SimulateAdapterParametersSchema,
    }),
  );
}
export namespace Bluetooth {
  export const SimulateAdapterParametersSchema = z.lazy(() =>
    z.object({
      context: z.string(),
      state: z.enum(['absent', 'powered-off', 'powered-on']),
    }),
  );
}
export namespace Bluetooth {
  export const SimulatePreconnectedPeripheralSchema = z.lazy(() =>
    z.object({
      method: z.literal('bluetooth.simulatePreconnectedPeripheral'),
      params: Bluetooth.SimulatePreconnectedPeripheralParametersSchema,
    }),
  );
}
export namespace Bluetooth {
  export const SimulatePreconnectedPeripheralParametersSchema = z.lazy(() =>
    z.object({
      context: z.string(),
      address: z.string(),
      name: z.string(),
      manufacturerData: z.array(Bluetooth.BluetoothManufacturerDataSchema),
      knownServiceUuids: z.array(Bluetooth.BluetoothServiceUuidSchema),
    }),
  );
}
export namespace Bluetooth {
  export const SimulateAdvertisementSchema = z.lazy(() =>
    z.object({
      method: z.literal('bluetooth.simulateAdvertisement'),
      params: Bluetooth.SimulateAdvertisementParametersSchema,
    }),
  );
}
export namespace Bluetooth {
  export const SimulateAdvertisementParametersSchema = z.lazy(() =>
    z.object({
      context: z.string(),
      scanEntry: Bluetooth.SimulateAdvertisementScanEntryParametersSchema,
    }),
  );
}
export namespace Bluetooth {
  export const SimulateAdvertisementScanEntryParametersSchema = z.lazy(() =>
    z.object({
      deviceAddress: z.string(),
      rssi: z.number(),
      scanRecord: Bluetooth.ScanRecordSchema,
    }),
  );
}
export namespace Bluetooth {
  export const RequestDevicePromptUpdatedSchema = z.lazy(() =>
    z.object({
      method: z.literal('bluetooth.requestDevicePromptUpdated'),
      params: Bluetooth.RequestDevicePromptUpdatedParametersSchema,
    }),
  );
}
export namespace Bluetooth {
  export const RequestDevicePromptUpdatedParametersSchema = z.lazy(() =>
    z.object({
      context: z.string(),
      prompt: Bluetooth.RequestDevicePromptSchema,
      devices: z.array(Bluetooth.RequestDeviceInfoSchema),
    }),
  );
}
