# Copyright 2023 Google LLC.
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

import pytest
from test_helpers import execute_command, goto_url

HISTORY_LENGTH = 2


@pytest.mark.asyncio
async def test_traverse_history(websocket, context_id, html):
    for i in range(HISTORY_LENGTH + 1):
        await goto_url(websocket, context_id, html(i))

    await traverse_history(websocket, context_id, -2)
    await assert_href_equals(websocket, context_id, html(HISTORY_LENGTH - 2))

    await traverse_history(websocket, context_id, 2)
    await assert_href_equals(websocket, context_id, html(HISTORY_LENGTH))

    await traverse_history(websocket, context_id, -1)
    await assert_href_equals(websocket, context_id, html(HISTORY_LENGTH - 1))

    await traverse_history(websocket, context_id, 1)
    await assert_href_equals(websocket, context_id, html(HISTORY_LENGTH))

    await traverse_history(websocket, context_id, 0)
    await assert_href_equals(websocket, context_id, html(HISTORY_LENGTH))


@pytest.mark.asyncio
async def test_traverse_history_no_entry(websocket, context_id, html):
    await goto_url(websocket, context_id, html())

    with pytest.raises(Exception,
                       match=str({
                           "error": "no such history entry",
                           "message": "No history entry at delta -2"
                       })):
        await traverse_history(websocket, context_id, -2)


async def traverse_history(websocket, context_id, delta):
    await execute_command(
        websocket, {
            "method": "browsingContext.traverseHistory",
            "params": {
                "context": context_id,
                "delta": delta
            }
        })


async def assert_href_equals(websocket, context_id, href):
    result = await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "window.location.href",
                "target": {
                    "context": context_id
                },
                "resultOwnership": "none",
                "awaitPromise": True
            }
        })

    assert result["result"]["value"] == href
