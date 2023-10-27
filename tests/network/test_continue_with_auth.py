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
from anys import ANY_DICT, ANY_LIST, ANY_STR
from test_helpers import (ANY_TIMESTAMP, ANY_UUID, AnyExtending,
                          execute_command, send_JSON_command, subscribe,
                          wait_for_event)

from . import create_blocked_request


@pytest.mark.asyncio
async def test_continue_with_auth_non_existent_request(websocket):
    with pytest.raises(
            Exception,
            match=str({
                "error": "no such request",
                "message": "No blocked request found for network id '_UNKNOWN_'"
            })):
        await execute_command(
            websocket, {
                "method": "network.continueWithAuth",
                "params": {
                    "request": '_UNKNOWN_',
                    "action": "cancel",
                },
            })


@pytest.mark.asyncio
@pytest.mark.parametrize("phase", ["beforeRequestSent", "responseStarted"])
async def test_continue_with_auth_invalid_phase(websocket, context_id,
                                                example_url, phase):

    network_id = await create_blocked_request(websocket,
                                              context_id,
                                              url=example_url,
                                              phases=[phase])

    with pytest.raises(
            Exception,
            match=str({
                "error": "invalid argument",
                "message": f"Blocked request for network id '{network_id}' is not in 'AuthRequired' phase"
            })):
        await execute_command(
            websocket, {
                "method": "network.continueWithAuth",
                "params": {
                    "request": network_id,
                    "action": "cancel",
                },
            })


@pytest.mark.asyncio
async def test_continue_with_auth_non_blocked_request(
        websocket, context_id, assert_no_events_in_queue, hang_url):
    await subscribe(websocket, [
        "network.beforeRequestSent", "network.responseCompleted",
        "network.fetchError"
    ])

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": hang_url,
                "context": context_id,
                "wait": "complete",
            }
        })

    before_request_sent_event = await wait_for_event(
        websocket, "network.beforeRequestSent")

    # Assert these events never happen, otherwise the test is ineffective.
    await assert_no_events_in_queue(
        ["network.responseCompleted", "network.fetchError"], timeout=1.0)

    assert not before_request_sent_event["params"]["isBlocked"]

    network_id = before_request_sent_event["params"]["request"]["request"]

    with pytest.raises(
            Exception,
            match=str({
                "error": "no such request",
                "message": f"No blocked request found for network id '{network_id}'",
            })):
        await execute_command(
            websocket, {
                "method": "network.continueWithAuth",
                "params": {
                    "request": network_id,
                    "action": "cancel",
                },
            })


@pytest.mark.asyncio
@pytest.mark.parametrize("credentials", [{}, {
    "type": "notapassword",
    "username": "user",
    "password": "pass"
}],
                         ids=["empty", "invalid type value"])
async def test_continue_with_auth_invalid_credentials(websocket, context_id,
                                                      auth_required_url,
                                                      credentials):
    await subscribe(websocket, [
        "network.beforeRequestSent", "network.authRequired",
        "network.responseCompleted"
    ], [context_id])

    await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["authRequired"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": auth_required_url,
                }, ],
            },
        })

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": auth_required_url,
                "context": context_id,
                "wait": "complete",
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
    }
    network_id = event_response["params"]["request"]["request"]

    with pytest.raises(Exception,
                       match=str({
                           "error": "invalid argument",
                           "message": "Invalid input in ."
                       })):
        await execute_command(
            websocket, {
                "method": "network.continueWithAuth",
                "params": {
                    "request": network_id,
                    "action": "provideCredentials",
                    "credentials": credentials,
                },
            })


@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO: Fix this test")
async def test_continue_with_auth_completes(websocket, context_id,
                                            auth_required_url):
    await subscribe(websocket, [
        "network.beforeRequestSent", "network.authRequired",
        "network.responseCompleted"
    ], [context_id])

    await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["authRequired"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": auth_required_url,
                }, ],
            },
        })

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": auth_required_url,
                "context": context_id,
                "wait": "complete",
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
    }
    network_id = event_response["params"]["request"]["request"]

    await execute_command(
        websocket, {
            "method": "network.continueWithAuth",
            "params": {
                "request": network_id,
                "action": "cancel",
            },
        })

    event_response = await wait_for_event(websocket,
                                          "network.responseCompleted")
    assert event_response == {
        "method": "network.responseCompleted",
        "params": {
            "context": context_id,
            "isBlocked": False,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": ANY_DICT,
            "response": AnyExtending({
                "headers": [{
                    "name": "header1",
                    "value": {
                        "type": "string",
                        "value": "value1",
                    },
                }, ],
                "url": auth_required_url,
                "status": 501,
                "statusText": "Remember to drink water",
            }),
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    }


@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO: Fix this test")
async def test_continue_with_auth_twice(websocket, context_id, example_url):
    await subscribe(websocket,
                    ["network.beforeRequestSent", "network.responseCompleted"],
                    [context_id])

    await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["responseStarted"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": example_url,
                }, ],
            },
        })

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": example_url,
                "context": context_id,
                "wait": "complete",
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
            "isBlocked": False,
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

    await execute_command(
        websocket, {
            "method": "network.continueWithAuth",
            "params": {
                "request": network_id,
                "action": "cancel",
            },
        })

    event_response = await wait_for_event(websocket,
                                          "network.responseCompleted")

    with pytest.raises(
            Exception,
            match=str({
                "error": "no such request",
                "message": f"No blocked request found for network id '{network_id}'"
            })):
        await execute_command(
            websocket, {
                "method": "network.continueWithAuth",
                "params": {
                    "request": network_id,
                    "action": "cancel",
                },
            })


@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO: Fix this test")
async def test_continue_with_auth_remove_intercept_inflight_request(
        websocket, context_id, example_url, auth_required_url):
    await subscribe(websocket,
                    ["network.beforeRequestSent", "network.responseCompleted"],
                    [context_id])

    await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["authRequired"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": example_url,
                }, ],
            },
        })

    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["authRequired"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": auth_required_url,
                }, ],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }
    intercept_id = result["intercept"]

    await send_JSON_command(
        websocket, {
            "method": "browsingContext.navigate",
            "params": {
                "url": auth_required_url,
                "context": context_id,
                "wait": "complete",
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
            "isBlocked": False,
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
    }
    network_id = event_response["params"]["request"]["request"]

    result = await execute_command(
        websocket, {
            "method": "network.removeIntercept",
            "params": {
                "intercept": intercept_id,
            },
        })
    assert result == {}

    await execute_command(
        websocket, {
            "method": "network.continueWithAuth",
            "params": {
                "request": network_id,
                "action": "cancel",
            },
        })

    event_response = await wait_for_event(websocket,
                                          "network.responseCompleted")
    assert event_response == {
        "method": "network.responseCompleted",
        "params": {
            "context": context_id,
            "isBlocked": False,
            "navigation": ANY_STR,
            "redirectCount": 0,
            "request": ANY_DICT,
            "response": ANY_DICT,
            "timestamp": ANY_TIMESTAMP,
        },
        "type": "event",
    }


# TODO: Globally replace "example_url" with "auth_required_url".
