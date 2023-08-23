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
from test_helpers import ANY_UUID, execute_command


@pytest.mark.asyncio
async def test_add_intercept_invalid_empty_phases(websocket):
    with pytest.raises(Exception) as exception_info:
        await execute_command(
            websocket, {
                "method": "network.addIntercept",
                "params": {
                    "phases": [],
                    "urlPatterns": [{
                        "type": 'string',
                        "pattern": "https://www.example.com/*",
                    }],
                },
            })

    assert {
        "error": "invalid argument",
        "message": "At least one phase must be specified."
    } == exception_info.value.args[0]


@pytest.mark.asyncio
async def test_add_intercept_returns_intercept_id(websocket):
    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["beforeRequestSent"],
                "urlPatterns": [{
                    "type": "string",
                    "pattern": "https://www.example.com/*"
                }],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }


@pytest.mark.asyncio
async def test_add_intercept_type_pattern_valid(websocket):
    result = await execute_command(
        websocket, {
            "method": "network.addIntercept",
            "params": {
                "phases": ["beforeRequestSent"],
                "urlPatterns": [{
                    "type": "pattern",
                    "protocol": "https",
                    "hostname": "www.example.com",
                    "path": "/*",
                }],
            },
        })

    assert result == {
        "intercept": ANY_UUID,
    }


@pytest.mark.asyncio
async def test_add_intercept_type_pattern_invalid(websocket):
    with pytest.raises(Exception) as exception_info:
        await execute_command(
            websocket, {
                "method": "network.addIntercept",
                "params": {
                    "phases": ["beforeRequestSent"],
                    "urlPatterns": [{
                        "type": "pattern",
                        "hostname": "foo"
                    }],
                },
            })

    assert {
        "error": "invalid argument",
        "message": "TypeError: Failed to construct 'URL': Invalid URL"
    } == exception_info.value.args[0]


@pytest.mark.asyncio
async def test_add_intercept_type_string_invalid(websocket):
    with pytest.raises(Exception) as exception_info:
        await execute_command(
            websocket, {
                "method": "network.addIntercept",
                "params": {
                    "phases": ["beforeRequestSent"],
                    "urlPatterns": [{
                        "type": "string",
                        "pattern": "foo",
                    }],
                },
            })

    assert {
        "error": "invalid argument",
        "message": "Invalid URL 'foo': TypeError: Failed to construct 'URL': Invalid URL"
    } == exception_info.value.args[0]


@pytest.mark.asyncio
async def test_add_intercept_type_string_one_valid_and_one_invalid(websocket):
    with pytest.raises(Exception) as exception_info:
        await execute_command(
            websocket, {
                "method": "network.addIntercept",
                "params": {
                    "phases": ["beforeRequestSent"],
                    "urlPatterns": [{
                        "type": "string",
                        "pattern": "foo",
                    }, {
                        "type": "string",
                        "pattern": "https://www.example.com/",
                    }],
                },
            })

    assert {
        "error": "invalid argument",
        "message": "Invalid URL 'foo': TypeError: Failed to construct 'URL': Invalid URL"
    } == exception_info.value.args[0]


@pytest.mark.asyncio
async def test_add_intercept_type_pattern_protocol_empty_invalid(websocket):
    with pytest.raises(Exception) as exception_info:
        await execute_command(
            websocket, {
                "method": "network.addIntercept",
                "params": {
                    "phases": ["beforeRequestSent"],
                    "urlPatterns": [{
                        "type": "pattern",
                        "protocol": "",
                        "hostname": "www.example.com",
                        "port": "80",
                    }],
                },
            })

    assert {
        "error": "invalid argument",
        "message": "TypeError: Failed to construct 'URL': Invalid URL"
    } == exception_info.value.args[0]


@pytest.mark.asyncio
async def test_add_intercept_type_pattern_hostname_empty_invalid(websocket):
    with pytest.raises(Exception) as exception_info:
        await execute_command(
            websocket, {
                "method": "network.addIntercept",
                "params": {
                    "phases": ["beforeRequestSent"],
                    "urlPatterns": [{
                        "type": "pattern",
                        "protocol": "https",
                        "hostname": "",
                        "port": "80",
                    }],
                },
            })

    assert {
        "error": "invalid argument",
        "message": "TypeError: Failed to construct 'URL': Invalid URL"
    } == exception_info.value.args[0]


@pytest.mark.asyncio
async def test_add_intercept_type_pattern_port_empty_invalid(websocket):
    with pytest.raises(Exception) as exception_info:
        await execute_command(
            websocket, {
                "method": "network.addIntercept",
                "params": {
                    "phases": ["beforeRequestSent"],
                    "urlPatterns": [{
                        "type": "pattern",
                        "protocol": "https",
                        "hostname": "www.example.com",
                        "port": "",
                    }],
                },
            })

    assert {
        "error": "invalid argument",
        "message": "TypeError: Failed to construct 'URL': Invalid URL"
    } == exception_info.value.args[0]
