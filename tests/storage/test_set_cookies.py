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

from datetime import datetime, timedelta

import pytest
from storage import get_bidi_cookie, get_hostname_and_origin
from test_helpers import execute_command

SOME_COOKIE_NAME = 'some_cookie_name'
SOME_COOKIE_VALUE = 'some_cookie_value'
ANOTHER_COOKIE_NAME = 'another_cookie_name'
ANOTHER_COOKIE_VALUE = 'another_cookie_value'

SOME_URL = 'https://some_domain.com:1234/some/path?some=query#some-fragment'


@pytest.mark.asyncio
async def test_cookie_set_with_required_fields(websocket, context_id):
    hostname, expected_origin = get_hostname_and_origin(SOME_URL)
    resp = await execute_command(
        websocket, {
            'method': 'storage.setCookie',
            'params': {
                'cookie': {
                    'name': SOME_COOKIE_NAME,
                    'value': {
                        'type': 'string',
                        'value': SOME_COOKIE_VALUE
                    },
                    'domain': hostname,
                }
            }
        })
    assert resp == {'partitionKey': {}}

    resp = await execute_command(websocket, {
        'method': 'storage.getCookies',
        'params': {}
    })
    assert resp == {
        'cookies': [
            get_bidi_cookie(SOME_COOKIE_NAME,
                            SOME_COOKIE_VALUE,
                            hostname,
                            secure=False)
        ],
        'partitionKey': {}
    }


@pytest.mark.asyncio
async def test_cookie_set_partition_context(websocket, context_id):
    hostname, expected_origin = get_hostname_and_origin(SOME_URL)
    resp = await execute_command(
        websocket, {
            'method': 'storage.setCookie',
            'params': {
                'cookie': {
                    'secure': True,
                    'name': SOME_COOKIE_NAME,
                    'value': {
                        'type': 'string',
                        'value': SOME_COOKIE_VALUE
                    },
                    'domain': hostname,
                },
                'partition': {
                    'type': 'context',
                    'context': context_id
                }
            }
        })
    assert resp == {'partitionKey': {}}

    resp = await execute_command(websocket, {
        'method': 'storage.getCookies',
        'params': {}
    })
    assert resp == {
        'cookies': [
            get_bidi_cookie(SOME_COOKIE_NAME,
                            SOME_COOKIE_VALUE,
                            hostname,
                            secure=True)
        ],
        'partitionKey': {}
    }


@pytest.mark.asyncio
async def test_cookie_set_partition_source_origin(websocket, context_id):
    hostname, expected_origin = get_hostname_and_origin(SOME_URL)
    resp = await execute_command(
        websocket, {
            'method': 'storage.setCookie',
            'params': {
                'cookie': {
                    'secure': True,
                    'name': SOME_COOKIE_NAME,
                    'value': {
                        'type': 'string',
                        'value': SOME_COOKIE_VALUE
                    },
                    'domain': hostname,
                },
                'partition': {
                    'type': 'storageKey',
                    'sourceOrigin': expected_origin,
                }
            }
        })
    assert resp == {
        'partitionKey': {
            'sourceOrigin': 'https://some_domain.com'
        }
    }

    resp = await execute_command(websocket, {
        'method': 'storage.getCookies',
        'params': {}
    })
    assert resp == {
        'cookies': [
            get_bidi_cookie(SOME_COOKIE_NAME,
                            SOME_COOKIE_VALUE,
                            hostname,
                            secure=True)
        ],
        'partitionKey': {}
    }


@pytest.mark.asyncio
async def test_cookie_set_with_all_fields(websocket, context_id):
    hostname, expected_origin = get_hostname_and_origin(SOME_URL)
    some_path = "/SOME_PATH"
    http_only = True
    secure = True
    same_site = 'lax'
    expiry = int((datetime.now() + timedelta(hours=1)).timestamp())

    resp = await execute_command(
        websocket, {
            'method': 'storage.setCookie',
            'params': {
                'cookie': {
                    'name': SOME_COOKIE_NAME,
                    'value': {
                        'type': 'string',
                        'value': SOME_COOKIE_VALUE
                    },
                    'domain': hostname,
                    'path': some_path,
                    'httpOnly': http_only,
                    'secure': secure,
                    'sameSite': same_site,
                    'expiry': expiry,
                },
            }
        })
    assert resp == {'partitionKey': {}}

    resp = await execute_command(websocket, {
        'method': 'storage.getCookies',
        'params': {}
    })
    assert resp == {
        'cookies': [
            get_bidi_cookie(SOME_COOKIE_NAME, SOME_COOKIE_VALUE, hostname,
                            some_path, http_only, secure, same_site, expiry)
        ],
        'partitionKey': {}
    }


@pytest.mark.asyncio
async def test_cookie_set_expired(websocket, context_id):
    hostname, expected_origin = get_hostname_and_origin(SOME_URL)
    expiry = int((datetime.now() - timedelta(seconds=1)).timestamp())
    resp = await execute_command(
        websocket, {
            'method': 'storage.setCookie',
            'params': {
                'cookie': get_bidi_cookie(SOME_COOKIE_NAME,
                                          SOME_COOKIE_VALUE,
                                          hostname,
                                          expiry=expiry),
            }
        })
    assert resp == {'partitionKey': {}}

    resp = await execute_command(websocket, {
        'method': 'storage.getCookies',
        'params': {}
    })
    assert resp == {'cookies': [], 'partitionKey': {}}
