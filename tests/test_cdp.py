# Copyright 2021 Google LLC.
# Copyright (c) Microsoft Corporation.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from unittest.mock import ANY

import pytest
from anys import ANY_INT
from test_helpers import (ANY_TIMESTAMP, execute_command, read_JSON_message,
                          send_JSON_command, subscribe)


@pytest.mark.asyncio
async def test_cdp_sendCommand_resultReturned(websocket):
    command_result = await execute_command(
        websocket, {
            "method": "cdp.sendCommand",
            "params": {
                "method": "Target.getTargets",
                "params": {}
            }
        })

    assert {"result": {"targetInfos": ANY}} == command_result


@pytest.mark.asyncio
async def test_cdp_subscribe_toSpecificEvent(websocket, context_id,
                                             get_cdp_session_id):
    await subscribe(websocket, ["cdp.Runtime.consoleAPICalled"])

    session_id = await get_cdp_session_id(context_id)

    await send_JSON_command(
        websocket, {
            "method": "cdp.sendCommand",
            "params": {
                "method": "Runtime.evaluate",
                "params": {
                    "expression": "console.log(1)",
                },
                "session": session_id
            }
        })
    resp = await read_JSON_message(websocket)

    assert {
        "type": "event",
        "method": "cdp.Runtime.consoleAPICalled",
        "params": {
            "event": "Runtime.consoleAPICalled",
            "params": {
                "type": "log",
                "args": [{
                    "type": "number",
                    "value": 1,
                    "description": "1"
                }],
                "executionContextId": ANY_INT,
                "timestamp": ANY_TIMESTAMP,
                "stackTrace": ANY
            },
            "session": session_id
        }
    } == resp
