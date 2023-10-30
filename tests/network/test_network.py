#  Copyright 2023 Google LLC.
#  Copyright (c) Microsoft Corporation.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
import pytest
from anys import ANY_DICT, ANY_LIST, ANY_NUMBER, ANY_STR, AnyOr
from test_helpers import (ANY_TIMESTAMP, AnyExtending, execute_command,
                          goto_url, read_JSON_message, send_JSON_command,
                          subscribe, wait_for_event)


@pytest.mark.asyncio
async def test_network_before_request_sent_event_emitted(
        websocket, context_id):
    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": "http://example.com",
                "wait": "complete",
                "context": context_id
            }
        })

    resp = await read_JSON_message(websocket)

    assert resp == {
        'type': 'event',
        "method": "network.beforeRequestSent",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": "http://example.com/",
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": ANY_NUMBER,
                "bodySize": 0,
                "timings": ANY_DICT
            },
            "initiator": {
                "type": "other"
            },
            "timestamp": ANY_TIMESTAMP
        }
    }


@pytest.mark.asyncio
async def test_network_global_subscription_enabled_in_new_context(
        websocket, create_context):
    await subscribe(websocket, ["network.beforeRequestSent"])

    new_context_id = await create_context()
    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": "http://example.com",
                "wait": "complete",
                "context": new_context_id
            }
        })

    resp = await read_JSON_message(websocket)

    assert resp == AnyExtending({
        'type': 'event',
        "method": "network.beforeRequestSent",
        "params": {
            "context": new_context_id
        }
    })


@pytest.mark.asyncio
async def test_network_before_request_sent_event_with_cookies_emitted(
        websocket, context_id):
    await goto_url(websocket, context_id, "http://example.com")

    await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "document.cookie = 'foo=bar'",
                "target": {
                    "context": context_id,
                },
                "awaitPromise": True,
                "resultOwnership": "root"
            }
        })

    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": "http://example.com/qwe",
                "wait": "complete",
                "context": context_id
            }
        })

    resp = await read_JSON_message(websocket)
    assert resp == {
        'type': 'event',
        "method": "network.beforeRequestSent",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": "http://example.com/qwe",
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": AnyOr([{
                    "domain": "example.com",
                    "expires": -1,
                    "httpOnly": False,
                    "name": "foo",
                    "path": "/",
                    "sameSite": "none",
                    "secure": False,
                    "size": 6,
                    "value": {
                        "type": "string",
                        "value": "bar"
                    },
                }], []),
                "headersSize": ANY_NUMBER,
                "bodySize": 0,
                "timings": ANY_DICT
            },
            "initiator": {
                "type": "other"
            },
            "timestamp": ANY_TIMESTAMP
        }
    }


@pytest.mark.asyncio
async def test_network_response_completed_event_emitted(websocket, context_id):
    await subscribe(websocket, ["network.responseCompleted"], [context_id])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": "http://example.com",
                "wait": "complete",
                "context": context_id
            }
        })

    resp = await read_JSON_message(websocket)
    headersSize = compute_response_headers_size(
        resp["params"]["response"]["headers"])

    assert resp == {
        'type': 'event',
        "method": "network.responseCompleted",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": AnyOr(0, 1),
            "request": {
                "request": ANY_STR,
                "url": AnyOr("http://example.com/", "https://example.com/"),
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": ANY_NUMBER,
                "bodySize": 0,
                "timings": ANY_DICT
            },
            "timestamp": ANY_TIMESTAMP,
            "response": {
                "url": AnyOr("http://example.com/", "https://example.com/"),
                "protocol": AnyOr("http/1.1", "h2"),
                "status": AnyOr(200, 307),
                "statusText": AnyOr("OK", "", "Temporary Redirect"),
                "fromCache": False,
                "headers": ANY_LIST,
                "mimeType": AnyOr("", "text/html"),
                "bytesReceived": ANY_NUMBER,
                "headersSize": headersSize,
                "bodySize": 0,
                "content": {
                    "size": 0
                }
            }
        }
    }


@pytest.mark.asyncio
async def test_network_bad_ssl(websocket, context_id, bad_ssl_url):
    await subscribe(websocket, ["network.fetchError"], [context_id])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": bad_ssl_url,
                "wait": "complete",
                "context": context_id
            }
        })

    resp = await read_JSON_message(websocket)
    assert resp == {
        'type': 'event',
        "method": "network.fetchError",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": bad_ssl_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": ANY_NUMBER,
                "bodySize": 0,
                "timings": ANY_DICT
            },
            "timestamp": ANY_TIMESTAMP,
            "errorText": "net::ERR_CERT_DATE_INVALID"
        }
    }


@pytest.mark.asyncio
async def test_network_before_request_sent_event_with_data_url_emitted(
        websocket, context_id):
    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": "data:text/html,hello",
                "wait": "complete",
                "context": context_id
            }
        })
    resp = await read_JSON_message(websocket)
    assert resp == {
        'type': 'event',
        "method": "network.beforeRequestSent",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": "data:text/html,hello",
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": ANY_LIST,
                "headersSize": 0,
                "bodySize": 0,
                "timings": ANY_DICT
            },
            "initiator": {
                "type": "other"
            },
            "timestamp": ANY_TIMESTAMP
        }
    }


def compute_response_headers_size(headers) -> int:
    return sum(
        len(header['name']) + len(header['value']['value']) + 4
        for header in headers)


@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO: #1080")
async def test_network_specific_context_subscription_does_not_enable_cdp_network_globally(
        websocket, context_id, create_context):
    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])

    new_context_id = await create_context()

    await subscribe(websocket, ["cdp.Network.requestWillBeSent"])

    command_id = await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": "http://example.com",
                "wait": "complete",
                "context": new_context_id
            }
        })
    resp = await read_JSON_message(websocket)
    while "id" not in resp:
        # Assert CDP events are not from Network.
        assert resp["method"].startswith("cdp")
        assert not resp["params"]["event"].startswith("Network"), \
            "There should be no `Network` cdp events, but was " \
            f"`{ resp['params']['event'] }` "
        resp = await read_JSON_message(websocket)

    assert resp == AnyExtending({"type": "success", "id": command_id})


@pytest.mark.asyncio
async def test_network_sends_only_included_cookies(websocket, context_id):

    await goto_url(websocket, context_id, "https://example.com")

    await execute_command(
        websocket, {
            "method": "script.evaluate",
            "params": {
                "expression": "document.cookie = 'foo=bar;secure'",
                "target": {
                    "context": context_id,
                },
                "awaitPromise": True,
                "resultOwnership": "root"
            }
        })

    await subscribe(websocket, ["network.beforeRequestSent"])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": "http://example.com/",
                "wait": "complete",
                "context": context_id
            }
        })

    response = await read_JSON_message(websocket)
    assert response == {
        'type': 'event',
        "method": "network.beforeRequestSent",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": "http://example.com/",
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": ANY_NUMBER,
                "bodySize": 0,
                "timings": ANY_DICT
            },
            "initiator": {
                "type": "other"
            },
            "timestamp": ANY_TIMESTAMP
        }
    }


@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO: #1350")
async def test_network_should_not_block_queue_shared_workers_with_data_url(
        websocket, context_id):

    await subscribe(websocket, ["network.beforeRequestSent"])

    await goto_url(websocket, context_id, "https://example.com")

    await send_JSON_command(
        websocket, {
            "method": "script.callFunction",
            "params": {
                "functionDeclaration": "() => {new SharedWorker('data:text/javascript,console.log(`hi`)');}",
                "target": {
                    "context": context_id
                },
                "awaitPromise": True,
            }
        })

    response = await wait_for_event(websocket, 'network.beforeRequestSent')
    assert response == {
        'type': 'event',
        "method": "network.beforeRequestSent",
        "params": {
            "isBlocked": False,
            "context": context_id,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": 'data:text/javascript,console.log("hi")',
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": ANY_NUMBER,
                "bodySize": 0,
                "timings": ANY_DICT
            },
            "initiator": {
                "type": "script"
            },
            "timestamp": ANY_TIMESTAMP
        }
    }
