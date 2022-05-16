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

import { InvalidArgumentErrorResponse } from '../error';
import { BrowsingContext } from '../bidiProtocolTypes';

export namespace BrowsingContextParser {
  export class BrowsingContextParser {
    public static parseOptionalList(
      contexts: any
    ): BrowsingContext.BrowsingContext[] | undefined {
      if (contexts === undefined) return undefined;
      if (!Array.isArray(contexts))
        throw new InvalidArgumentErrorResponse(
          "Wrong format parameter 'contexts'. Not an array."
        );

      return contexts.map((c) => this.parse(c));
    }

    public static parse(context: any): BrowsingContext.BrowsingContext {
      if (context === undefined)
        throw new InvalidArgumentErrorResponse(
          'BrowsingContext should not be undefined'
        );
      if (typeof context !== 'string' && !(context instanceof String))
        throw new InvalidArgumentErrorResponse(
          `BrowsingContext should be a string ${JSON.stringify(context)}.`
        );
      if (context.length == 0)
        throw new InvalidArgumentErrorResponse(
          `BrowsingContext cannot be empty ${JSON.stringify(context)}.`
        );

      return context as BrowsingContext.BrowsingContext;
    }
  }
}
