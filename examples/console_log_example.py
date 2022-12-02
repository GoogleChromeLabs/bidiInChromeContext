#!/usr/bin/env python3
#
# Copyright 2022 Google LLC.
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

import asyncio
import logging
from pathlib import Path
from _helpers import *

logging.basicConfig(
    format="%(message)s",
    level=logging.DEBUG,
)


async def main():
    # Part 1. Open a page.

    # Open browser
    websocket = await get_websocket()
    await run_and_wait_command({
        "id": 0,
        "method": "session.new",
        "params": {}}, websocket)

    # Open tab
    command_result = await run_and_wait_command({
        "id": 1000,
        "method": "browsingContext.create",
        "params": {
            "type": "tab"
        }}, websocket)
    # `command_result` should be like this:
    # {
    #     "id": 1000,
    #     "result": {
    #         "context": "__SOME_CONTEXT_ID__",
    #         "url": "",
    #         "children": []
    #     }
    # }
    context_id = command_result['result']['context']

    # Navigate to page
    pageUrl = f'about:blank'
    await run_and_wait_command({
        "id": 1001,
        "method": "browsingContext.navigate",
        "params": {
            "url": pageUrl,
            "context": context_id,
            "wait": "complete"
        }}, websocket)

    # Part 2. Subscribe to log events.

    # Subscribe to log.entryAdded
    command_result = await run_and_wait_command({
        "id": 1002,
        "method": "session.subscribe",
        "params": {
            "events": [
                "log.entryAdded"]}}, websocket)

    # Part 3. Evaluate console.log on the page.

    # Run console.log with script.evaluate
    await send_JSON_command({
        "id": 1003,
        "method": "script.evaluate",
        "params": {
            "expression": "console.log(`Hello, world!`);",
            "target": {"context": context_id},
            "awaitPromise": True}},
        websocket)

    # Part 4. Read the log.entryAdded event.

    # `event_response` should be like this:
    # {
    #     "method": "log.entryAdded",
    #     "params": {
    #         "level": "info",
    #         "source": {
    #             "realm": "__SOME_REALM_ID__",
    #             "context": "__SOME_CONTEXT_ID__",
    #         },
    #         "text": "Hello, world!",
    #         "args": [
    #             {
    #                 "type": "string",
    #                 "value": "Hello, world!",
    #             },
    #         ],
    #         ... // other values, such as stackTrace and timestamp
    #     }
    # }
    event_response = await read_JSON_message(websocket)
    print(
        f'text: {event_response["params"]["text"]}' + '\n'
        f'args: {event_response["params"]["args"]}')

loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
result = loop.run_until_complete(main())
