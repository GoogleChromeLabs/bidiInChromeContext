/**
 * Copyright 2021 Google Inc. All rights reserved.
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
import { assert, spy, SinonSpy } from 'sinon';
import { IServer } from '../iServer';

export class StubServer implements IServer {
  setOnMessage: ((messageObj: any) => Promise<any>) & SinonSpy<any[], any>;
  sendMessage: ((messageObj: any) => Promise<void>) & SinonSpy<any[], any>;

  getOnMessage(mock: StubServer): (string: string) => void {
    assert.called(mock.setOnMessage);
    const onMessage = mock.setOnMessage.getCall(0).args[0] as any as (
      string: string
    ) => void;
    return onMessage;
  }

  constructor() {
    this.sendMessage = spy() as any as ((messageObj: any) => Promise<any>) &
      SinonSpy<any[], any>;
    this.setOnMessage = spy() as any as ((messageObj: any) => Promise<void>) &
      SinonSpy<any[], any>;
  }
}
