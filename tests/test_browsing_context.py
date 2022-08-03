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
async def test_browsingContext_getTree_contextReturned(websocket, context_id):
    result = await execute_command(websocket, {
        "method": "browsingContext.getTree",
        "params": {}})

    assert result == {
        "contexts": [{
            "context": context_id,
            "children": [],
            "parent": None,
            "url": "about:blank"}]}


@pytest.mark.asyncio
async def test_browsingContext_getTreeWithRoot_contextReturned(websocket,
      context_id):
    result = await execute_command(websocket, {
        "method": "browsingContext.create",
        "params": {"type": "tab"}})
    new_context_id = result["context"]

    result = await execute_command(websocket, {
        "method": "browsingContext.getTree",
        "params": {}})

    assert len(result['contexts']) == 2

    result = await execute_command(websocket, {
        "method": "browsingContext.getTree",
        "params": {
            "root": new_context_id}})

    assert result == {
        "contexts": [{
            "context": new_context_id,
            "parent": None,
            "url": "about:blank",
            "children": []
        }]}


@pytest.mark.asyncio
async def test_navigateToPageWithHash_contxtInfoUpdated(
      websocket,
      context_id):
    url = "data:text/html,<h2>test</h2>"
    url_with_hash_1 = url + "#1"

    # Initial navigation.
    await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url_with_hash_1,
            "wait": "complete",
            "context": context_id}})

    result = await execute_command(websocket, {
        "method": "browsingContext.getTree",
        "params": {}})

    assert result == {
        "contexts": [{
            "context": context_id,
            "children": [],
            "parent": None,
            "url": url_with_hash_1}]}


@pytest.mark.asyncio
async def test_browsingContext_getTreeWithNestedSameOriginContexts_contextsReturned(
      websocket, context_id):
    nested_iframe = 'data:text/html,<h1>CHILD_PAGE</h1>'
    page_with_nested_iframe = f'data:text/html,<h1>MAIN_PAGE</h1>' \
                              f'<iframe src="{nested_iframe}" />'
    await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": page_with_nested_iframe,
            "wait": "complete",
            "context": context_id}})

    result = await execute_command(websocket, {
        "method": "browsingContext.getTree",
        "params": {}})

    recursive_compare({
        "contexts": [{
            "context": context_id,
            "children": [{
                "context": any_string,
                "url": nested_iframe,
                "children": []
            }],
            "parent": None,
            "url": page_with_nested_iframe}]},
        result)


# TODO(sadym): make offline.
@pytest.mark.asyncio
async def test_browsingContext_getTreeWithNestedCrossOriginContexts_contextsReturned(
      websocket, context_id):
    nested_iframe = 'https://example.com/'
    page_with_nested_iframe = f'data:text/html,<h1>MAIN_PAGE</h1>' \
                              f'<iframe src="{nested_iframe}" />'
    await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": page_with_nested_iframe,
            "wait": "complete",
            "context": context_id}})

    result = await execute_command(websocket, {
        "method": "browsingContext.getTree",
        "params": {}})

    recursive_compare({
        "contexts": [{
            "context": context_id,
            "children": [{
                "context": any_string,
                "url": nested_iframe,
                "children": []
            }],
            "parent": None,
            "url": page_with_nested_iframe}]},
        result)


@pytest.mark.asyncio
async def test_browsingContext_create_eventContextCreatedEmitted(
      websocket, context_id):
    await subscribe(websocket, ["browsingContext.contextCreated"])

    await send_JSON_command(websocket, {
        "id": 9,
        "method": "browsingContext.create",
        "params": {"type": "tab"}})

    resp = await read_JSON_message(websocket)

    if "params" in resp:
        event = resp
        command_result = await read_JSON_message(websocket)
    else:
        event = await read_JSON_message(websocket)
        command_result = resp

    new_context_id = event['params']['context']

    # Assert "browsingContext.contextCreated" event emitted.
    assert event == {
        "method": "browsingContext.contextCreated",
        "params": {
            'context': new_context_id,
            'parent': None,
            'children': None,
            'url': 'about:blank'}}

    # Assert command done.
    assert command_result == {
        "id": 9,
        "result": {
            'context': new_context_id,
            'parent': None,
            'children': [],
            'url': 'about:blank'}}


@pytest.mark.asyncio
async def test_browsingContext_createWithNestedSameOriginContexts_eventContextCreatedEmitted(
      websocket, context_id):
    nested_iframe = 'data:text/html,<h1>PAGE_WITHOUT_CHILD_IFRAMES</h1>'
    intermediate_page = 'data:text/html,<h1>PAGE_WITH_1_CHILD_IFRAME</h1>' \
                        '<iframe src="' + \
                        nested_iframe.replace('"', '&quot;') + \
                        '" />'
    top_level_page = 'data:text/html,<h1>PAGE_WITH_2_CHILD_IFRAMES</h1>' \
                     '<iframe src="' + \
                     intermediate_page.replace('"', '&quot;') + \
                     '" />'

    await subscribe(websocket, ["browsingContext.contextCreated"])

    command = {
        "method": "browsingContext.navigate",
        "params": {
            "url": top_level_page,
            "wait": "complete",
            "context": context_id}}
    await send_JSON_command(websocket, command)

    events = []
    while len(events) < 2:
        resp = await read_JSON_message(websocket)
        if "method" in resp and \
              resp["method"] == "browsingContext.contextCreated":
            events.append(resp)

    tree = await execute_command(websocket,
                                 {"method": "browsingContext.getTree",
                                  "params": {}})

    recursive_compare({
        "contexts": [{
            "context": any_string,
            "parent": None,
            "url": top_level_page,
            "children": [{
                "context": any_string,
                # It's not guaranteed the nested page is already loaded.
                "url": any_string,
                "children": [{
                    "context": any_string,
                    # It's not guaranteed the nested page is already loaded.
                    "url": any_string,
                    "children": []}]}, ]}]
    }, tree)

    intermediate_page_context_id = tree["contexts"][0]["children"][0]["context"]
    nested_iframe_context_id = \
        tree["contexts"][0]["children"][0]["children"][0]["context"]
    assert events[0] == {
        "method": "browsingContext.contextCreated",
        "params": {
            'context': intermediate_page_context_id,
            'parent': context_id,
            'children': None,
            'url': 'about:blank'}}

    assert events[1] == {
        "method": "browsingContext.contextCreated",
        "params": {
            'context': nested_iframe_context_id,
            'parent': intermediate_page_context_id,
            'children': None,
            'url': 'about:blank'}}


@pytest.mark.asyncio
async def test_browsingContext_close_browsingContext_closed(
      websocket, context_id):
    await subscribe(websocket, ["browsingContext.contextDestroyed"])

    # Send command.
    command = {"id": 12, "method": "browsingContext.close",
               "params": {"context": context_id}}
    await send_JSON_command(websocket, command)

    # Assert "browsingContext.contextCreated" event emitted.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "method": "browsingContext.contextDestroyed",
        "params": {
            "context": context_id,
            "parent": None,
            "url": "about:blank",
            "children": None}}

    # Assert command done.
    resp = await read_JSON_message(websocket)
    assert resp == {"id": 12, "result": {}}

    result = await execute_command(websocket,
                                   {"method": "browsingContext.getTree",
                                    "params": {}})

    # Assert context is closed.
    assert result == {'contexts': []}


@pytest.mark.asyncio
async def test_browsingContext_navigateWaitNone_navigated(websocket,
      context_id):
    await subscribe(websocket, ["browsingContext.domContentLoaded",
                                "browsingContext.load"])
    # Send command.
    await send_JSON_command(websocket, {
        "id": 13,
        "method": "browsingContext.navigate",
        "params": {
            "url": "data:text/html,<h2>test</h2>",
            "wait": "none",
            "context": context_id}})

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
async def test_browsingContext_navigateWaitInteractive_navigated(websocket,
      context_id):
    await subscribe(websocket, ["browsingContext.domContentLoaded",
                                "browsingContext.load"])

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
async def test_browsingContext_navigateWaitComplete_navigated(websocket,
      context_id):
    await subscribe(websocket, ["browsingContext.domContentLoaded",
                                "browsingContext.load"])

    # Send command.
    command = {
        "id": 15,
        "method": "browsingContext.navigate",
        "params": {
            "url": "data:text/html,<h2>test</h2>",
            "wait": "complete",
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

    # Assert command done.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "id": 15,
        "result": {
            "navigation": navigation_id,
            "url": "data:text/html,<h2>test</h2>"}}

    # Wait for `browsingContext.domContentLoaded` event.
    resp = await read_JSON_message(websocket)
    assert resp == {
        "method": "browsingContext.domContentLoaded",
        "params": {
            "context": context_id,
            "navigation": navigation_id}}


@pytest.mark.asyncio
async def test_browsingContext_navigateSameDocumentNavigation_navigated(
      websocket,
      context_id):
    url = "data:text/html,<h2>test</h2>"
    url_with_hash_1 = url + "#1"
    url_with_hash_2 = url + "#2"

    # Initial navigation.
    await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url,
            "wait": "complete",
            "context": context_id}})

    # Navigate back and forth in the same document with `wait:none`.
    resp = await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url_with_hash_1,
            "wait": "none",
            "context": context_id}})
    assert resp == {
        'navigation': None,
        'url': url_with_hash_1}

    resp = await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url_with_hash_2,
            "wait": "none",
            "context": context_id}})
    assert resp == {
        'navigation': None,
        'url': url_with_hash_2}

    # Navigate back and forth in the same document with `wait:interactive`.
    resp = await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url_with_hash_1,
            "wait": "interactive",
            "context": context_id}})
    assert resp == {
        'navigation': None,
        'url': url_with_hash_1}

    resp = await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url_with_hash_2,
            "wait": "interactive",
            "context": context_id}})
    assert resp == {
        'navigation': None,
        'url': url_with_hash_2}

    # Navigate back and forth in the same document with `wait:complete`.
    resp = await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url_with_hash_1,
            "wait": "complete",
            "context": context_id}})
    assert resp == {
        'navigation': None,
        'url': url_with_hash_1}

    resp = await execute_command(websocket, {
        "method": "browsingContext.navigate",
        "params": {
            "url": url_with_hash_2,
            "wait": "complete",
            "context": context_id}})
    assert resp == {
        'navigation': None,
        'url': url_with_hash_2}


@pytest.mark.asyncio
async def test_PROTO_browsingContext_findElement_findsElement(websocket,
      context_id):
    await goto_url(websocket, context_id,
                   "data:text/html," +
                   "<div class='container'>container text" +
                   "<h2 class='child_1'>child 1 text</h2>" +
                   "<h2 class='child_2'>child 2 text</h2>" +
                   "</div>")

    result = await execute_command(websocket, {
        "method": "PROTO.browsingContext.findElement",
        "params": {
            "selector": "body > .container",
            "context": context_id}})

    recursive_compare({
        "realm": any_string,
        "result": {
            "type": "node",
            "handle": any_string,
            "value": {
                "nodeType": 1,
                "nodeValue": "",
                "nodeName": "",
                "localName": "div",
                "namespaceURI": "http://www.w3.org/1999/xhtml",
                "childNodeCount": 3,
                "attributes": {
                    "class": "container"},
                "children": [{
                    "type": "node",
                    "value": {
                        "nodeType": 3,
                        "nodeValue": "container text",
                        "nodeName": "container text"}
                }, {
                    "type": "node",
                    "value": {
                        "nodeType": 1,
                        "nodeValue": "",
                        "nodeName": "",
                        "localName": "h2",
                        "namespaceURI": "http://www.w3.org/1999/xhtml",
                        "childNodeCount": 1,
                        "attributes": {
                            "class": "child_1"}}
                }, {
                    "type": "node",
                    "value": {
                        "nodeType": 1,
                        "nodeValue": "",
                        "nodeName": "",
                        "localName": "h2",
                        "namespaceURI": "http://www.w3.org/1999/xhtml",
                        "childNodeCount": 1,
                        "attributes": {
                            "class": "child_2"}}}]}}},
        result)


@pytest.mark.asyncio
async def test_PROTO_browsingContext_findElementMissingElement_missingElement(
      websocket, context_id):
    await goto_url(websocket, context_id,
                   "data:text/html,<h2>test</h2>")

    result = await execute_command(websocket, {
        "method": "PROTO.browsingContext.findElement",
        "params": {
            "selector": "body > h3",
            "context": context_id}})

    recursive_compare({
        "realm": any_string,
        "result": {
            "type": "null"}},
        result)


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_type_textTyped():
    pass
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_navigateWithShortTimeout_timeoutOccurredAndEventPageLoadEmitted():
    pass
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelector_success():
    pass
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelector_success_slow():
    # 1. Wait for element which is not on the page.
    # 2. Assert element not found.
    # 3. Add element to the page.
    # 4. Wait for newly created element.
    # 5. Assert element found.

    pass
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForHiddenSelector_success():
    pass
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelectorWithMinimumTimeout_failedWithTimeout():
    pass
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_waitForSelectorWithMissingElement_failedWithTimeout_slow():
    pass
    # TODO sadym: implement


@pytest.mark.asyncio
# Not implemented yet.
async def _ignore_test_browsingContext_clickElement_clickProcessed():
    pass
    # TODO sadym: implement
