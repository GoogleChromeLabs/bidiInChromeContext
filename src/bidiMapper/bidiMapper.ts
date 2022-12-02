/**
<<<<<<< HEAD
 * Copyright 2022 Google LLC.
=======
 * Copyright 2021 Google LLC.
>>>>>>> be6ad33 (Define CDP interfaces that mapper needs)
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
 * The entry point to the BiDi Mapper namespace.
 * Other modules should only access exports defined in this file.
 * TODO: eslint rule for this.
 */

export {CommandProcessor} from './commandProcessor';
export {CDPConnection, CDPClient} from './cdp';
export {IBidiServer} from './bidiServer';
