/**
 * Copyright 2022 Google LLC.
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

import { IContext } from './IContext';
import { BrowsingContext, Script } from '../protocol/bidiProtocolTypes';

export abstract class Context implements IContext {
  static _contexts: Map<string, IContext> = new Map();

  abstract callFunction(
    functionDeclaration: string,
    _this: Script.ArgumentValue,
    _arguments: Script.ArgumentValue[],
    awaitPromise: boolean
  ): Promise<Script.CallFunctionResult>;

  abstract getSessionId(): string;

  abstract get id(): string;

  abstract navigate(
    url: string,
    wait: BrowsingContext.ReadinessState
  ): Promise<BrowsingContext.NavigateResult>;

  abstract scriptEvaluate(
    expression: string,
    awaitPromise: boolean
  ): Promise<Script.EvaluateResult>;

  abstract serializeToBidiValue(): BrowsingContext.Info;

  public async findElement(
    selector: string
  ): Promise<BrowsingContext.PROTO.FindElementResult> {
    const functionDeclaration = String((resultsSelector: string) =>
      document.querySelector(resultsSelector)
    );
    const _arguments: Script.ArgumentValue[] = [
      { type: 'string', value: selector },
    ];

    // TODO(sadym): handle not found exception.
    const result = await this.callFunction(
      functionDeclaration,
      {
        type: 'undefined',
      },
      _arguments,
      true
    );

    // TODO(sadym): handle type properly.
    return { result } as any as BrowsingContext.PROTO.FindElementResult;
  }
}
