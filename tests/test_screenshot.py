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

import os

import pytest
from test_helpers import (execute_command, goto_url, read_JSON_message,
                          send_JSON_command)

IMAGE_BASE_64 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAAEgVJREFUeJztndF25CgMROmc/bH9s/3ysA8T92BQSYKi205S5KFPPDYgoZKsvrM7j1prLRoaGub4uHoDGhp3HhKIhoYzJBANDWdIIBoazpBANDScIYFoaDhDAtHQcMY/0Q3//ftfeZRHedRHeZRHKbWUx+PP50f5+PP71/WPx0epn7V8PLrrx31fz6HrH+Wj1FrP1z/LMN+j+dk1XymL9nwa/lixpz62+ufYfz9frTl7TueN5lv1T+PvLfZ85fklez79+E9VkFpqqY9a6p/ZS61fn931z/r5vN5+fpbPv/eV85/XRy0Hq/ws+Pn++vFjzuc8N+znuG7Y+bSnxvs5fdZxX9Y85r4X/TPY0/up3XfCntR8X/7pz93dT2Pn51d09v5x/Wv5tbtu2Yn2E41QIF4QwEWRWJxgDo0G87XOPAVZ55zhMILDj+yx5nuuEwXZo5r29Ou7/gXBtc2eatgzMd9w3lG8dKJA/kH+HZ7vRWasv0UgfTAOlaQsVhIn85rrZJxgBRcShbUOuD+Vua11Antm9u1Wkhr7tw3u0/PFsNPZXzq5tfuxxNtcX7EH7hudA9o3KxCUKbPOgpnFyvBEZknvJ5l54X6SmTJjz7ZKAoIhzPyG2LKZF4nItKdLDl5Sytrjvi42STuyhxYICoZtlcQSX/Aumu5Jan6+qZ4ksZ/hkAu4jux5ZyXZ3JPAimE93/ckSf+EycMSnVVJWIGclGgdcmazmczbP29lqOLPV4vTA6z0JOD1oJS9PcmSf/rnmUpirM/0JKgymsmrfx69Tk9W2mxlpAUCM2PZ3JNYwbrwDh+KF4kiWGf627EN9ix/+7f6Do+uB/4Oe8vEfVf1JLRA2uBGmXdLT9I9/5J3eMNZu78NGta5aU9i7scQW6YnKcUR+UolQeKdtac7X+scaIGEGbpZ3DJCnARXEvM6eE6cpOAKY5yTd72vMJRAUNCH7/DiJKY94iQTlcQR6S5OQgvk2EwmWMVJHHusdcRJruckrEC8TPDSnkScRJzEC/bs+QSchBZItBkUDOIkcYWx/IMyJQwq5B8juMVJDNGxAtnOFcCfi5Ns9k//PFNJjPV/CiehBWIFySU9iRWs4iTiJIw9u77FqiX3zi1OsmDPTXuS38JJaIGgIE1n6kNk4iThvCf/TPpbnKTgCmOcU/s7JZB+c9ve4cVJ5vzb3ydO4oo024PyAgE9RL8ZcRKQoZx1xEn8+97CSWiBEJlFnGQ9U96tJ0FB9t05CS0QlAFNp4mTuHaKkwTzXcBJaIFERouTBPaIk5ySzd04CS2Q06E6PUS/GXGSUVQwGF9kjzhJwh5WINlvb8RJ9mTeYZ2b9iQ/hZPQAsk4AQWPOIlvpzhJMN87OAkrkJOR/e/G5sRJnCAteXvESTZUEkekx3y0QGBGK0AERpCIk2ARe+uIk/j37eAktEDMclnGTaxkFnGS9Ux5t57EfN4Q2904CS+Q5Dt3ymniJK6d4iTBfK/gJLRAQHC/vSdxnJDKvM76ZqYRJwkzfyopgvXvwklogWQzQCniJHAdzx4jOMVJnH0u3gcrPSuQIVMFlcTcXBEn8YK1n2/Knpv2JN+Fk9AC8RbLOgEFjziJb6c4STDfJk5CCQRu+uqeRJzEtEecZKKS7KggXqPjieHY3G17EifzipNMVpLvzElogQBnZXoScZL1zCtOgjN/LXZcwfNxOAktkKcSLSMzPQm4juaLMsdJfO1zxnVxktE/KPPDoEL+MYL7O3ISWiBeEN+qJ/GckMm8gT39/eIkGyuJsf67OAktkN4IpicRJwHrePYYwSlO4uxz9j5WINNcQZzk+ZMRhzjJmCSi+XZyElogUImH04zDgMYBJ6DgESfx7RQnCebLcBJWIMdmUHDBTV/dk4iTmPaIk5zPhxaIl1nYnsQUgREk4iRYxN464iT+fYfoKIFklThkoERPIk6ynnnFSc72DPMlexJeINl3ZstIcZLRHiNYxUmCSvJKTkILBBwK7EnESeB8tYiTeP5rgzlafxcnoQWSMb41QpwEiCf4FCdxkg3Zk0TrUAKB3zt7wWU4S5wEZ0pxkuR5G2JjOQktkOVMdTjNOAz3ecMJKHjESXw7xUmC+eqGb7HaTXmHIk6CxenNJ07iV5Jle5I9CS2QlWBvjRAnKad37mwmFydJVJJunSVOwgrECtKt7/DiJIM94iTJ8zbENstJaIGYwcr0JM7mxUnsYBUnCSoJ0ZPQAvGcttSTiJPA+WoRJ/H814ojWj/bk9ACCTNVwvjWCHESIJ7gU5zESTZMT8IK5KlEJ/OLk/iZF4lfnGS9kuziJLRAkEK39STGYbjPG05AwSNO4tspTrKhgpwWMZwiTuJXkow4vfnESfxKsmzP1/nSAvGCOvU9vpNZxEnO9oqTgErySk7CCgS+w8/0JAuZV5zktZlXnOTP77RAwk1bwSpOIk7SZf7BnrtwElYgKLiW3uGbQxEnweJE89UiTuL5rxVHtP5hDy2QY/IU5/CULU5i24XW8TK2518kimCdX8tJWIF4SlzuSYo9n5dZxElwphQnSZ63ITZeILM9QOkywGqmOpxmHIb7vOEEFDziJL6dv4KT0AJBQZbM5OIkfiXJiNObT5zErySRPbRAzKCf6ElWgj1cR5wk718kCmsdcP9P5ySUQKzMgDKLOMmEPeIkt+AktED6RS/vSR7jYUztx3OaOIlr54/kJKxAUDBah+FmqiC4+0MRJ8HiRPPVIk7i+a8Vx/HJCyTzjipOsr2StPOJkwCx7OAktECMSbOZQJxkPVOKkyTsISrJcR8tkFJsxR+/X96TGIfhPl/ESVL+/SWchBaIZ+SOnkScxK8kGXF684mT+JWEFkjv7N09yUqwh+uIk+T9i0Qxc95v6km8fS/3JKxA3MzSHL44Cc5s4iTn+e7Uk9ACQZkFLXp5T/IYD2NqP55IxElcO78lJ2EFgjKLtbg4iS8ecZIJ/7L+6Z8HYqEFAjNAeU1PIk6SqyTtfOIk65WEFshU5jcO38sE4iTrmVKcJGFPopLwAklyBXGSiaQhTuL77Z2chBYI2BzTQ8zMJ07iV5KMOL35fjsnoQUym3nFSXCwipM49ljrvIOTsAKJglGcJGmPdYiZTCdOAu3ZUUlogfSKXnqHFyex7WmfM66Lk4z+sfxNcRJWIFCJs+/w4iS+Pf3zfRCJk7ykZ9sikCg4xUkW7AnmEyfh7cl++8cLxHtnFicptYiTeMHazzdlz4t7Elogz00CI8VJ7CBNZ2oraYiT+H7byElogXiHexKNOIk4yUy8BPa8i5PQAumNMI0UJ3EzmzhJcN5v6knMfbMCcb9CW8i8KMjESZL+zdojTpKqJLRAzOBGPYk4iS8ScRLXzqs4CSWQpxKjTVqH6mQWcRLjPs+e/vk+iMRJlvxDCwQ5+1j0mVlmM28RJ3H3E8wnTsLbs4WkZzMl/F2cpNQiTuIFaz/flD1kT0ILJBUM4iSDPVGQpjO1lTTESXy/zXASViDIiFRPUircnDiJH/TiJL49uzgJLZBI8b0RppHiJG5mEycJzvuVPQkrkPDbjjf1JOIkSf9m7REnKfWxQSBe8E/3JOIkvkjESVw7X8JJWIGk3+EzPYk4yeAPcZLAnhdzElog6PC/a08iTpKrJO18P5qTsAKJMos4ST1nKnGS509GHFdzElogJyODzCFOkrcnCtJ0pg6SmDgJriTHvJRAkHFbepJynm8q84qTzPtnoZJkxOnNd3dOskUgg9N+UE+yEuzhOuIkef8iUcycN9mT0AKZDp7ib16cBCeb2vxM2ZP1b9aeX8JJaIE8F7UOwdq8OMmcPSiJgPlgBbHsaZ8zrouTbKwg4TuzOIkrrst7kv75Poh+KSehBTIcvrXpH9STiJPkKkk737fmJKxAzHfenZnfCD5xEj/zpuzJ+teZL2WPEYSn+27OSWiBwEWtQxAn+ZupDnu6wxUn6YLaEfNbOAkrELTZTCURJ/H9460vTjJpTx8vgT3HfLRAZjO/OEliHXGSvH+RKGbO26tsrEC8TJBqaMVJhv2Jk/j2vJOT8ALJvBOKk4TzLduDkgiYD2Vk0572OeP6r+AktECMRc3MEL0zi5O44rq8J+mf74Pwh3ISWiAwA1ibEyfxnxcnweLJJkckimAdGC+sQPq/u+JlAnGSXKbs9ydOMtqTFQfLSWiBpJXYO9E6BHGSv5n3sKc7XHGSLqgdMW/pSViBoMPrNy9OEtgjTuLefxUn4QWS5QXW5sRJ3EwuTnK29xJOQgsEBGO2J1kKnuI7SZwEJ5va/EzZk/Vv1p5vwklogZwyQ4ZrICdahyBO8te/q/agJALmgxXEsqd9zrj+EzgJLRCY4Tf1JOIkOIhv1ZP0z/dB+E05CS2QUIkoA1ibEyfxnxcnweLJJkckCsceSiDZTClOgtcXJ3Hs6Z/vKsSrOQktEPNQ+8MSJ7FFJk4SVpLLOQkrkJPiLZGAw4Oi8owWJ/HtuVNP8kM4CS0Qd9MbepJTEB9G/qCeZCXYw3XESfL+RSIvf+OSEshq5hUnweuLk4AMn0gyuzkJLxCUebsgFScBh2oFqzjJfTgJLRDgLJTB2gwhTuLsR5zEFgewZ4ifTZyEFoiVcbzyLk7i2y1Okqsk7Xwv5SSsQHpxvLonESeJM2W/P3GS0Z6UOB6hPjb8G4XWofaHJU5ii0ycJKwkL+ckrEA8ZXqZRZwkN584iV9JMuL05os4yRaBhMGFNr2hJ+nXESdJrCNOkvfvFoH075hl3FwY7F0wipPg9cVJRv+8ipPQAokOTZwEB7s4yYZK4pz7Dk5CC8RzjunEfpPiJKn5ouAe7BEnce/PchJaIKlM1fx44hAnie0WJ8lVknY+ipOwAoGvA+3hFbw5cRKcKcVJ1ivJLk5CC2QQSWCkOMk5qC/vSUox9xXZEwVpOlNbSeNmnIQSCDzEiZ5EnMQIMnGSW3ASWiBRRoaiANf7QxAnCexeCPZwHXGSU1xRAll6hy/j5sJg74JRnASvL04y+meVk9AC6TPA87N1rjjJ6CeQsS/vSWbtQUkEzAcriGVP+5xx/S2chBWIZZy5uDhJ6B9xkgn/9vHyIk5CC2RQrBNE4iRjJREnwZXkFpyEFcjUO7xhXC8OcRI/mMVJ8v5J2dM/31U8XiBo88XoSRJGipOcg/rynqQUc1+RPVGQWmIzP62k8U5OQgsEOA8G9XFdnMQOmqQ94iSGPQuVJBInLRDkrJ09iRf04iSB3QvBHq7zmzgJK5DI2eIkc/5BQSZOkvRv1p4kJ6EFktlkmwGen61zxUlGP4GMfXlPMmsPSiJgPhg/lj3tc8b1LZyEFUhvdOad13SaOEnoH3GSCf/28bLISbYIJMoE4iTrlUScBFeSd3ESWiAzmbLfjDjJhD3APyhTipOsV5JjP7RAnouCTYuTFHESw54oSGFyzSSNjZyEFojnjFNQiJOE/pnKvOIk8/5ZqCS0QKLMi5wlTrKWecVJcCV5CSdhBbKSeVcyCxSHOIk4ibG+93vKnl3fYlmHZ/6H8OIk5yC0gkCcxBfJRZyEEggyMvz/DomT+ElEnOQWnIQWiOds750bKtYJInGSsZKIk+BKsqMnoQXSHwqbKd35DON6cYiT+MEsTpL3T3mE+lj4NwoNY8VJ4sp0EnnGniBTipM4SWOGk9ACAUak3uHLedPiJL5/pjKvOMm8f4xKQguEzbzIWeIka5lXnARXkqWehBUIzCx1PfOuZBYoDnEScRJjfe/39pMWiHe4bk8SBAXKAM/P1rniJKOfQMa+vCeZtQclETAfjB/LnvY54/pxrpRAkLFWEIYiKeIk3uGKkzj+deZjOAkvECJTipOAYE34R5wE+3trT0ILpHfObOaPnC1OIk7inc/Xz6s4CS2Q06REJUGbFicp4iSGPZHoYHLNJI16/nNKIHDxHe/wpa7NV2zneEEmTjIGa2a+n85JaIH0m979bRByljjJWuYVJ8GVBPUklEDCTCdOMh88s/aIk+DzzdoD/EkLxFLuVCUxDk+cZL4yzVYSlLEv70lm7UFJBMznJvPenrKhggyKR4uLk5hiECfBQXyHnoQWyGBct2lxEuyfKXsm/SNOgv0905OE4V8znYqGxi8dqW+xNDR+65BANDScIYFoaDhDAtHQcIYEoqHhDAlEQ8MZEoiGhjP+B+200be/RKSmAAAAAElFTkSuQmCC'

if os.getenv("GITHUB_ACTIONS"):
    EXPECTED_IMAGE_BASE_64 = IMAGE_BASE_64
else:
    EXPECTED_IMAGE_BASE_64 = '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'

GRADIENT_HTML = 'data:image/png;base64,' + IMAGE_BASE_64


@pytest.mark.asyncio
async def test_screenshot_happy_path(websocket, context_id):
    await goto_url(websocket, context_id, GRADIENT_HTML)

    command_result = await execute_command(websocket, {
        "method": "cdp.getSession",
        "params": {
            "context": context_id
        }
    })
    session_id = command_result["cdpSession"]

    # Set a fixed viewport to make the test deterministic.
    await execute_command(
        websocket, {
            "method": "cdp.sendCommand",
            "params": {
                "cdpMethod": "Emulation.setDeviceMetricsOverride",
                "cdpParams": {
                    "width": 200,
                    "height": 200,
                    "deviceScaleFactor": 1.0,
                    "mobile": False,
                },
                "cdpSession": session_id
            }
        })

    await send_JSON_command(
        websocket, {
            "id": 1,
            "method": "browsingContext.captureScreenshot",
            "params": {
                "context": context_id
            }
        })

    resp = await read_JSON_message(websocket)

    assert resp == {'id': 1, 'result': {'data': EXPECTED_IMAGE_BASE_64}}
