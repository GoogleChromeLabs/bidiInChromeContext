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

from _helpers import *


@pytest.mark.asyncio
async def test_consoleLog_logEntryAddedEventEmitted(websocket, context_id):
    # Send command.
    await send_JSON_command(websocket, {
        "id": 33,
        "method": "script.evaluate",
        "params": {
            "expression": "console.log('some log message','line 2')",
            "target": {"context": context_id},
            "awaitPromise": True}})

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert "log.entryAdded" event emitted.
    recursive_compare({
        "method": "log.entryAdded",
        "params": {
            # BaseLogEntry
            "level": "info",
            "source": {
                "realm": any_string,
                "context": context_id
            },
            "text": "some log message\u0020line 2",
            "timestamp": any_timestamp,
            "stackTrace": {
                "callFrames": [{
                    "url": "",
                    "functionName": "",
                    "lineNumber": 0,
                    "columnNumber": 8}]},
            # ConsoleLogEntry
            "type": "console",
            "method": "log",
            "args": [{
                "type": "string",
                "value": "some log message"}, {
                "type": "string",
                "value": "line 2"}]}},
        event_response)


@pytest.mark.asyncio
async def test_consoleLogWithNullUndefinedValues_logEntryAddedEventEmitted(
      websocket, context_id):
    # Send command.
    await send_JSON_command(websocket, {
        "id": 33,
        "method": "script.evaluate",
        "params": {
            "expression": "console.log(null, undefined)",
            "target": {"context": context_id},
            "awaitPromise": True}})

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert "log.entryAdded" event emitted.
    recursive_compare({
        "method": "log.entryAdded",
        "params": {
            # BaseLogEntry
            "level": "info",
            "source": {
                "realm": any_string,
                "context": context_id
            },
            "text": "null\u0020undefined",
            "timestamp": any_timestamp,
            "stackTrace": {
                "callFrames": [{
                    "url": "",
                    "functionName": "",
                    "lineNumber": 0,
                    "columnNumber": 8}]},
            # ConsoleLogEntry
            "type": "console",
            "method": "log",
            "args": [
                {"type": "null"},
                {"type": "undefined"}]}},
        event_response)


@pytest.mark.asyncio
async def test_consoleInfo_levelAndMethodAreCorrect(websocket, context_id):
    # Send command.
    await send_JSON_command(websocket, {
        "method": "script.evaluate",
        "params": {
            "expression": "console.info('some log message')",
            "target": {"context": context_id},
            "awaitPromise": True}})

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert method "info".
    assert event_response["method"] == "log.entryAdded"
    assert event_response["params"]["method"] == "info"
    assert event_response["params"]["level"] == "info"


@pytest.mark.asyncio
async def test_consoleDebug_levelAndMethodAreCorrect(websocket, context_id):
    # Send command.
    await send_JSON_command(websocket, {
        "method": "script.evaluate",
        "params": {
            "expression": "console.debug('some log message')",
            "target": {"context": context_id},
            "awaitPromise": True}})

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert method "error".
    assert event_response["method"] == "log.entryAdded"
    assert event_response["params"]["method"] == "debug"
    assert event_response["params"]["level"] == "debug"

@pytest.mark.asyncio
async def test_consoleWarn_levelAndMethodAreCorrect(websocket, context_id):
    # Send command.
    await send_JSON_command(websocket, {
        "method": "script.evaluate",
        "params": {
            "expression": "console.warn('some log message')",
            "target": {"context": context_id},
            "awaitPromise": True}})

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert method "error".
    assert event_response["method"] == "log.entryAdded"
    # Method is `console.warn`, while the level is `warning`.
    assert event_response["params"]["method"] == "warn"
    assert event_response["params"]["level"] == "warning"

@pytest.mark.asyncio
async def test_consoleError_levelAndMethodAreCorrect(websocket, context_id):
    # Send command.
    await send_JSON_command(websocket, {
        "method": "script.evaluate",
        "params": {
            "expression": "console.error('some log message')",
            "target": {"context": context_id},
            "awaitPromise": True}})

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert method "error".
    assert event_response["method"] == "log.entryAdded"
    assert event_response["params"]["method"] == "error"
    assert event_response["params"]["level"] == "error"


@pytest.mark.asyncio
async def test_consoleLog_logEntryAddedFormatOutput(websocket, context_id):
    # Send command.
    await send_JSON_command(websocket, {
        "id": 55,
        "method": "script.evaluate",
        "params": {
            "expression": "console.log('format specificier, string: %s, "
                          "integer: %d, integer: %i, float: %f, %o, %O, %c',"
                          "'line 2', 1, -2, 1.234, 'abc', {id: 1}, "
                          "{'font-size': '20px'})",
            "target": {"context": context_id},
            "awaitPromise": True}})

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert "log.entryAdded" event emitted.
    recursive_compare({
        "method": "log.entryAdded",
        "params": {
            # BaseLogEntry
            "level": "info",
            "source": {
                "realm": any_string,
                "context": context_id
            },
            "text": "format specificier, string: line 2, integer: 1, integer: "
                    "-2, float: 1.234, \"abc\", {\"id\": 1}, {\"font-size\": "
                    "\"20px\"}",
            "timestamp": any_timestamp,
            "stackTrace": {
                "callFrames": [{
                    "url": "",
                    "functionName": "",
                    "lineNumber": 0,
                    "columnNumber": 8}]},
            # ConsoleLogEntry
            "type": "console",
            "method": "log",
            "args": [{
                "type": "string",
                "value": "format specificier, string: %s, integer: %d, "
                         "integer: %i, float: %f, %o, %O, %c"
            }, {
                "type": "string",
                "value": "line 2"
            }, {
                "type": "number",
                "value": 1
            }, {
                "type": "number",
                "value": -2
            }, {
                "type": "number",
                "value": 1.234
            }, {
                "type": "string",
                "value": "abc"
            }, {
                "type": "object",
                "value": [
                    ["id", {
                        "type": "number",
                        "value": 1
                    }]]
            }, {
                "type": "object",
                "value": [[
                    "font-size", {
                        "type": "string",
                        "value": "20px"
                    }]]}]}},
        event_response)


@pytest.mark.asyncio
async def test_exceptionThrown_logEntryAddedEventEmitted(websocket, context_id):
    # Send command.
    command = {
        "id": 14,
        "method": "browsingContext.navigate",
        "params": {
            "url": "data:text/html,<script>throw new Error('some error')</script>",
            "wait": "interactive",
            "context": context_id}}
    await send_JSON_command(websocket, command)

    # Wait for responses
    event_response = await wait_for_event(websocket, "log.entryAdded")

    # Assert "log.entryAdded" event emitted.
    recursive_compare(
        {
            "method": "log.entryAdded",
            "params": {
                # BaseLogEntry
                "level": "error",
                "source": {
                    "realm": any_string,
                    "context": context_id
                },
                "text": "Error: some error",
                "timestamp": any_timestamp,
                "stackTrace": {
                    "callFrames": [{
                        "url": "",
                        "functionName": "",
                        "lineNumber": 0,
                        "columnNumber": 14}]},
                # ConsoleLogEntry
                "type": "javascript"}},
        event_response)
