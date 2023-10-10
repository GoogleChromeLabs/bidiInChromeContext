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
import pytest
from anys import ANY_DICT, ANY_LIST, ANY_NUMBER, ANY_STR
from test_helpers import (ANY_TIMESTAMP, ANY_UUID, AnyExtending,
                          execute_command, send_JSON_command, subscribe,
                          wait_for_event)


@pytest.mark.asyncio
async def test_fail_request_non_existent_request(websocket):
    with pytest.raises(
            Exception,
            match=str({
                "error": "no such request",
                "message": "No blocked request found for network id '_UNKNOWN_'"
            })):
        await execute_command(
            websocket, {
                "method": "network.failRequest",
                "params": {
                    "request": '_UNKNOWN_',
                },
            })


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="TODO: replace url with a server whose requests hang forever.")
async def test_fail_request_non_blocked_request(websocket, context_id,
                                                assert_no_events_in_queue):
    url = "http://127.0.0.1:5000/hang"

    await subscribe(websocket, [
        "network.beforeRequestSent", "cdp.Network.responseReceived",
        "cdp.Network.loadingFailed"
    ])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "context": context_id,
                "url": url,
                "wait": "complete",
            }
        })

    before_request_sent_event = await wait_for_event(
        websocket, "network.beforeRequestSent")

    # Assert these events never happen, otherwise the test is ineffective.
    await assert_no_events_in_queue(
        ["cdp.Network.responseReceived", "cdp.Network.loadingFailed"],
        timeout=1.0)

    assert not before_request_sent_event["params"]["isBlocked"]

    network_id = before_request_sent_event["params"]["request"]["request"]

    with pytest.raises(
            Exception,
            match=str({
                "error": "no such request",
                "message": f"No blocked request found for network id '{network_id}'",
            })):
        await execute_command(websocket, {
            "method": "network.failRequest",
            "params": {
                "request": network_id,
            },
        })


@pytest.mark.asyncio
async def test_fail_request_twice(websocket, context_id, example_url):
    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])

    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["beforeRequestSent"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": example_url,
                }, ],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": example_url,
                "context": context_id,
            }
        })

    event_response = await wait_for_event(websocket,
                                          "network.beforeRequestSent")
    assert event_response == {
        "method": "network.beforeRequestSent",
        "params": {
            "context": context_id,
            "initiator": {
                "type": "other",
            },
            "isBlocked": True,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": example_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": -1,
                "bodySize": 0,
                "timings": ANY_DICT,
            },
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    }
    network_id = event_response["params"]["request"]["request"]

    result = await execute_command(websocket, {
        "method": "network.failRequest",
        "params": {
            "request": network_id,
        },
    })
    assert result == {}

    with pytest.raises(
            Exception,
            match=str({
                "error": "no such request",
                "message": f"No blocked request found for network id '{network_id}'"
            })):
        await execute_command(websocket, {
            "method": "network.failRequest",
            "params": {
                "request": network_id
            },
        })


@pytest.mark.asyncio
@pytest.mark.parametrize("phases, exception_and_response_expected", [
    (["authRequired"], True),
    (["responseStarted"], True),
    (["authRequired", "responseStarted"], True),
    (["beforeRequestSent"], False),
    (["beforeRequestSent", "authRequired"], False),
],
                         ids=[
                             "authRequired",
                             "responseStarted",
                             "authRequired and responseStarted",
                             "beforeRequestSent",
                             "beforeRequestSent and authRequired",
                         ])
@pytest.mark.skip(reason="TODO: Use our own test server.")
async def test_fail_request_with_auth_required_phase(
        websocket, context_id, phases, exception_and_response_expected,
        auth_required_url):
    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])
    await subscribe(websocket, ["cdp.Fetch.requestPaused"])

    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": phases,
                "urlPatterns": [{
                    "type": "string",
                    "pattern": auth_required_url,
                }, ],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": auth_required_url,
                "context": context_id,
            }
        })

    network_event_response = await wait_for_event(websocket,
                                                  "network.beforeRequestSent")
    assert network_event_response == AnyExtending({
        "method": "network.beforeRequestSent",
        "params": {
            "context": context_id,
            "initiator": {
                "type": "other",
            },
            "isBlocked": not exception_and_response_expected,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": auth_required_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": -1,
                "bodySize": 0,
                "timings": ANY_DICT,
            },
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    })
    network_id_from_bidi_event = network_event_response["params"]["request"][
        "request"]

    # TODO: Replace with "network.authRequired" BiDi event when it is implemented.
    # If we remove this "wait_for_event" block the test fails.
    cdp_event_response = await wait_for_event(websocket,
                                              "cdp.Fetch.requestPaused")
    assert cdp_event_response == {
        "method": "cdp.Fetch.requestPaused",
        "params": {
            "event": "Fetch.requestPaused",
            "params": {
                "frameId": context_id,
                "networkId": ANY_STR,
                "request": AnyExtending({
                    "headers": ANY_DICT,
                    "url": auth_required_url,
                }),
                "requestId": ANY_STR,
                "resourceType": "Document",
            } | ({
                "responseStatusCode": 401,
                "responseStatusText": "Unauthorized",
                "responseHeaders": ANY_LIST,
            } if exception_and_response_expected else {}),
            "session": ANY_STR,
        },
        "type": "event",
    }
    network_id_from_cdp_event = cdp_event_response["params"]["params"][
        "networkId"]

    assert network_id_from_bidi_event == network_id_from_cdp_event

    if exception_and_response_expected:
        with pytest.raises(
                Exception,
                match=str({
                    "error": "invalid argument",
                    "message": f"Blocked request for network id '{network_id_from_bidi_event}' is in 'AuthRequired' phase"
                })):
            await execute_command(
                websocket, {
                    "method": "network.failRequest",
                    "params": {
                        "request": network_id_from_bidi_event
                    },
                })


@pytest.mark.asyncio
async def test_fail_request_completes(websocket, context_id, example_url):
    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])

    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["beforeRequestSent"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": example_url,
                }, ],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": example_url,
                "context": context_id,
            }
        })

    event_response = await wait_for_event(websocket,
                                          "network.beforeRequestSent")
    assert event_response == AnyExtending({
        "method": "network.beforeRequestSent",
        "params": {
            "context": context_id,
            "initiator": {
                "type": "other",
            },
            "isBlocked": True,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": example_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": -1,
                "bodySize": 0,
                "timings": ANY_DICT,
            },
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    })
    network_id = event_response["params"]["request"]["request"]

    await subscribe(websocket, ["cdp.Network.loadingFailed"])

    result = await execute_command(websocket, {
        "method": "network.failRequest",
        "params": {
            "request": network_id,
        },
    })
    assert result == {}

    loading_failed_response = await wait_for_event(
        websocket, "cdp.Network.loadingFailed")
    assert loading_failed_response == {
        "method": "cdp.Network.loadingFailed",
        "params": {
            "event": "Network.loadingFailed",
            "params": {
                "canceled": False,
                "errorText": "net::ERR_FAILED",
                "requestId": network_id,
                "timestamp": ANY_NUMBER,
                "type": "Document",
            },
            "session": ANY_STR,
        },
        "type": "event",
    }


@pytest.mark.asyncio
async def test_fail_request_completes_new_request_still_blocks(
        websocket, context_id, example_url):
    await subscribe(websocket, ["network.beforeRequestSent"], [context_id])

    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["beforeRequestSent"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": example_url,
                }, ],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": example_url,
                "context": context_id,
            }
        })

    event_response1 = await wait_for_event(websocket,
                                           "network.beforeRequestSent")
    assert event_response1 == AnyExtending({
        "method": "network.beforeRequestSent",
        "params": {
            "context": context_id,
            "initiator": {
                "type": "other",
            },
            "isBlocked": True,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": example_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": -1,
                "bodySize": 0,
                "timings": ANY_DICT,
            },
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    })
    network_id_1 = event_response1["params"]["request"]["request"]

    await subscribe(websocket, ["cdp.Network.loadingFailed"])

    result = await execute_command(websocket, {
        "method": "network.failRequest",
        "params": {
            "request": network_id_1,
        },
    })
    assert result == {}

    loading_failed_response = await wait_for_event(
        websocket, "cdp.Network.loadingFailed")
    assert loading_failed_response == {
        "method": "cdp.Network.loadingFailed",
        "params": {
            "event": "Network.loadingFailed",
            "params": {
                "canceled": False,
                "errorText": "net::ERR_FAILED",
                "requestId": network_id_1,
                "timestamp": ANY_NUMBER,
                "type": "Document",
            },
            "session": ANY_STR,
        },
        "type": "event",
    }

    # Perform the same navigation again.
    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": example_url,
                "context": context_id,
            }
        })

    event_response2 = await wait_for_event(websocket,
                                           "network.beforeRequestSent")
    assert event_response2 == AnyExtending({
        "method": "network.beforeRequestSent",
        "params": {
            "context": context_id,
            "initiator": {
                "type": "other",
            },
            "isBlocked": True,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": example_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": -1,
                "bodySize": 0,
                "timings": ANY_DICT,
            },
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    })
    network_id_2 = event_response2["params"]["request"]["request"]

    assert event_response1 != event_response2

    # The second request should have a different ID.
    assert network_id_1 != network_id_2


@pytest.mark.asyncio
async def test_fail_request_multiple_contexts(websocket, context_id,
                                              another_context_id, example_url):
    await subscribe(websocket, ["network.beforeRequestSent"])

    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["beforeRequestSent"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": example_url,
                }, ],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }

    # Navigation in first context.
    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": example_url,
                "context": context_id,
            }
        })

    event_response1 = await wait_for_event(websocket,
                                           "network.beforeRequestSent")
    assert event_response1 == AnyExtending({
        "method": "network.beforeRequestSent",
        "params": {
            "context": context_id,
            "initiator": {
                "type": "other",
            },
            "isBlocked": True,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": example_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": -1,
                "bodySize": 0,
                "timings": ANY_DICT,
            },
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    })
    network_id_1 = event_response1["params"]["request"]["request"]

    # Navigation in second context.
    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": example_url,
                "context": another_context_id,
            }
        })

    event_response2 = await wait_for_event(websocket,
                                           "network.beforeRequestSent")
    assert event_response2 == AnyExtending({
        "method": "network.beforeRequestSent",
        "params": {
            "context": another_context_id,
            "initiator": {
                "type": "other",
            },
            "isBlocked": True,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": {
                "request": ANY_STR,
                "url": example_url,
                "method": "GET",
                "headers": ANY_LIST,
                "cookies": [],
                "headersSize": -1,
                "bodySize": 0,
                "timings": ANY_DICT,
            },
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    })
    network_id_2 = event_response2["params"]["request"]["request"]

    assert network_id_1 != network_id_2

    await subscribe(websocket, ["cdp.Network.loadingFailed"])

    # Fail the first request.
    result = await execute_command(websocket, {
        "method": "network.failRequest",
        "params": {
            "request": network_id_1,
        },
    })
    assert result == {}

    loading_failed_response = await wait_for_event(
        websocket, "cdp.Network.loadingFailed")
    assert loading_failed_response == {
        "method": "cdp.Network.loadingFailed",
        "params": {
            "event": "Network.loadingFailed",
            "params": {
                "canceled": False,
                "errorText": "net::ERR_FAILED",
                "requestId": network_id_1,
                "timestamp": ANY_NUMBER,
                "type": "Document",
            },
            "session": ANY_STR,
        },
        "type": "event",
    }

    # Fail the second request.
    result = await execute_command(websocket, {
        "method": "network.failRequest",
        "params": {
            "request": network_id_2,
        },
    })
    assert result == {}

    loading_failed_response = await wait_for_event(
        websocket, "cdp.Network.loadingFailed")
    assert loading_failed_response == {
        "method": "cdp.Network.loadingFailed",
        "params": {
            "event": "Network.loadingFailed",
            "params": {
                "canceled": False,
                "errorText": "net::ERR_FAILED",
                "requestId": network_id_2,
                "timestamp": ANY_NUMBER,
                "type": "Document",
            },
            "session": ANY_STR,
        },
        "type": "event",
    }
