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
async def test_browsingContext_getTree_contextReturned(websocket):
    result = await execute_command(websocket,
                                   {"method": "browsingContext.getTree",
                                    "params": {}})

    # Assert "browsingContext.getTree" command done.
    [context] = result['contexts']
    context_id = context['context']
    assert isinstance(context_id, str)
    assert len(context_id) > 1
    assert result == {
        "contexts": [{
            "context": context_id,
            "children": [],
            "url": "about:blank"}]}


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_getTreeWithGivenParent_contextReturned(
      websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_getTreeWithNestedContexts_contextReturned(
      websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
async def test_browsingContext_create_eventContextCreatedEmittedAndContextCreated(
      websocket):
    await subscribe(websocket, ["browsingContext.contextCreated",
                                "browsingContext.domContentLoaded",
                                "browsingContext.load"])

    initial_context_id = await get_open_context_id(websocket)

    await send_JSON_command(websocket, {
        "id": 9,
        "method": "browsingContext.create",
        "params": {}})

    # Assert "browsingContext.contextCreated" event emitted.
    resp = await read_JSON_message(websocket)
    new_context_id = resp['params']['context']
    # TODO: replace with assertion after event is raised with proper URL.
    recursiveCompare({
        "method": "browsingContext.contextCreated",
        "params": {
            "context": new_context_id,
            "children": [],
            "url": "about:blank"}
    }, resp, ["url"])

    # Assert command done.
    resp = await read_JSON_message(websocket)
    # TODO: replace with assertion after event is raised with proper URL.
    recursiveCompare({
        "id": 9,
        "result": {
            "context": new_context_id,
            "children": [],
            "url": "about:blank"}
    }, resp, ["url"])

    # TODO: check the events order.
    # Wait for the page events.
    resp = await read_JSON_message(websocket)
    assert resp["method"] == "browsingContext.domContentLoaded"

    resp = await read_JSON_message(websocket)
    assert resp["method"] == "browsingContext.load"

    # Get all contexts and assert new context is created.
    command = {"id": 10, "method": "browsingContext.getTree", "params": {}}
    await send_JSON_command(websocket, command)

    # Assert "browsingContext.getTree" command done.
    # TODO sadym: make order-agnostic. Maybe order by `context`?
    resp = await read_JSON_message(websocket)
    assert resp == {
        "id": 10,
        "result": {
            "contexts": [{
                "context": new_context_id,
                "url": "about:blank",
                "children": []
            }, {
                "context": initial_context_id,
                "url": "about:blank",
                "children": []}]}}


@pytest.mark.asyncio
# TODO: fix test in headful mode.
async def test_DEBUG_browsingContext_close_browsingContext_contextDestroyedEmitted(
      websocket):
    await subscribe(websocket, ["browsingContext.contextDestroyed"])

    context_id = await get_open_context_id(websocket)

    # Send command.
    command = {"id": 12, "method": "PROTO.browsingContext.close",
               "params": {"context": context_id}}
    await send_JSON_command(websocket, command)

    # Assert "browsingContext.contextCreated" event emitted.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "method": "browsingContext.contextDestroyed",
        "params": {
            "context": context_id,
            "url": "about:blank",
            "children": []}}

    # Assert command done.
    resp = await read_JSON_message(websocket)
    assert resp == {"id": 12, "result": {}}


@pytest.mark.asyncio
async def test_browsingContext_navigateWaitNone_navigated(websocket):
    await subscribe(websocket, ["browsingContext.contextCreated",
                                "browsingContext.domContentLoaded",
                                "browsingContext.load"])

    context_id = await get_open_context_id(websocket)

    # Send command.
    command = {
        "id": 13,
        "method": "browsingContext.navigate",
        "params": {
            "url": "data:text/html,<h2>test</h2>",
            "wait": "none",
            "context": context_id}}
    await send_JSON_command(websocket, command)

    # Assert command done.
    resp = await read_JSON_message(websocket)
    navigation_id = resp["result"]["navigation"]
    assert resp == {
        "id": 13,
        "result": {
            "navigation": navigation_id,
            "url": "data:text/html,<h2>test</h2>"}}

    # Wait for `browsingContext.load` event.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "method": "browsingContext.load",
        "params": {
            "context": context_id,
            "navigation": navigation_id}}

    # Wait for `browsingContext.domContentLoaded` event.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "method": "browsingContext.domContentLoaded",
        "params": {
            "context": context_id,
            "navigation": navigation_id}}


@pytest.mark.asyncio
async def test_browsingContext_navigateWaitInteractive_navigated(websocket):
    await subscribe(websocket, ["browsingContext.contextCreated",
                                "browsingContext.domContentLoaded",
                                "browsingContext.load"])

    context_id = await get_open_context_id(websocket)

    # Send command.
    command = {
        "id": 14,
        "method": "browsingContext.navigate",
        "params": {
            "url": "data:text/html,<h2>test</h2>",
            "wait": "interactive",
            "context": context_id}}
    await send_JSON_command(websocket, command)

    # Wait for `browsingContext.load` event.
    resp = await read_JSON_message(websocket)
    navigation_id = resp["params"]["navigation"]
    assert resp == {
        "method": "browsingContext.load",
        "params": {
            "context": context_id,
            "navigation": navigation_id}}

    # Wait for `browsingContext.domContentLoaded` event.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "method": "browsingContext.domContentLoaded",
        "params": {
            "context": context_id,
            "navigation": navigation_id}}

    # Assert command done.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "id": 14,
        "result": {
            "navigation": navigation_id,
            "url": "data:text/html,<h2>test</h2>"}}


@pytest.mark.asyncio
async def test_PROTO_browsingContext_findElement_findsElement(websocket):
    context_id = await get_open_context_id(websocket)

    await goto_url(websocket, context_id,
                   "data:text/html,<div class='container'>test<h2 class='child_1'>child 1</h2><h2 class='child_2'>child 2</h2></div>")

    result = await execute_command(websocket, {
        "method": "PROTO.browsingContext.findElement",
        "params": {
            "selector": "body > .container",
            "context": context_id}})

    recursiveCompare({
        "objectId": "__SOME_OBJECT_ID_1__",
        "type": "node",
        "value": {
            "nodeType": 1,
            "childNodeCount": 3},
        "children": [{
            "objectId": "__CHILD_OBJECT_1__",
            "type": "node"
        }, {
            "objectId": "__CHILD_OBJECT_2__",
            "type": "node"
        }, {
            "objectId": "__CHILD_OBJECT_3__",
            "type": "node"}],
        "attributes": {"class": "container"}
    }, result, ["objectId"])


@pytest.mark.asyncio
async def test_PROTO_browsingContext_findElementMissingElement_missingElement(
      websocket):
    context_id = await get_open_context_id(websocket)

    await goto_url(websocket, context_id,
                   "data:text/html,<h2>test</h2>")

    result = await execute_command(websocket, {
        "method": "PROTO.browsingContext.findElement",
        "params": {
            "selector": "body > h3",
            "context": context_id}})

    assert result == {"type": "null"}


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_type_textTyped(websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_navigateWithShortTimeout_timeoutOccurredAndEventPageLoadEmitted(
      websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelector_success(websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelector_success_slow(websocket):
    # 1. Wait for element which is not on the page.
    # 2. Assert element not found.
    # 3. Add element to the page.
    # 4. Wait for newly created element.
    # 5. Assert element found.

    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForHiddenSelector_success(websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelectorWithMinimumTimeout_failedWithTimeout(
      websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelectorWithMissingElement_failedWithTimeout_slow(
      websocket):
    ignore = True
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_clickElement_clickProcessed(websocket):
    ignore = True
    # TODO sadym: implement
