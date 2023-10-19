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
 */

import {EventEmitter} from '../utils/EventEmitter';

export class SimpleTransport extends EventEmitter<Record<'message', string>> {
  readonly #sendCommandDelegate: (plainCommand: string) => Promise<void>;

  constructor(sendCommandDelegate: (plainCommand: string) => Promise<void>) {
    super();
    this.#sendCommandDelegate = sendCommandDelegate;
  }

  async sendCommand(plainCommand: string): Promise<void> {
    await this.#sendCommandDelegate(plainCommand);
  }
}
