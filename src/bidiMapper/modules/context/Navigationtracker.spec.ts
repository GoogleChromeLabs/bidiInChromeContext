/*
 *  Copyright 2024 Google LLC.
 *  Copyright (c) Microsoft Corporation.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

import {assert} from 'chai';
import sinon, {type SinonStubbedInstance} from 'sinon';

import {ChromiumBidi} from '../../../protocol/protocol.js';
import {EventManager} from '../session/EventManager.js';

import {NavigationTracker} from './NavigationTracker.js';

const BROWSING_CONTEXT_ID = 'browsingContextId';
const SOME_URL = 'SOME_URL';
const ANOTHER_URL = 'ANOTHER_URL';
const YET_ANOTHER_URL = 'YET_ANOTHER_URL';
const INITIAL_URL = 'INITIAL_URL';
const LOADER_ID = 'LOADER_ID';
const ANOTHER_LOADER_ID = 'ANOTHER_LOADER_ID';

describe('NavigationTracker', () => {
  let navigationTracker: NavigationTracker;
  let eventManager: SinonStubbedInstance<EventManager>;
  let initialNavigationId: string;

  async function assertNoNavigationEvents() {
    await new Promise((resolve) => setTimeout(resolve, 1));
    // `eventManager.registerEvent` is safe do be used unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    sinon.assert.notCalled(eventManager.registerEvent);
  }

  async function assertNavigationEvent(
    this: void,
    eventName: string,
    navigationId: string | sinon.SinonMatcher,
    url: string,
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    sinon.assert.calledWith(
      // `eventManager.registerEvent` is safe do be used unbound.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      eventManager.registerEvent,
      sinon.match({
        type: 'event',
        method: eventName,
        params: {
          context: BROWSING_CONTEXT_ID,
          navigation: navigationId,
          timestamp: sinon.match.any,
          url,
        },
      }),
      sinon.match(BROWSING_CONTEXT_ID),
    );
    eventManager.registerEvent.reset();
  }

  beforeEach(() => {
    eventManager = sinon.createStubInstance(EventManager);
    navigationTracker = new NavigationTracker(
      INITIAL_URL,
      BROWSING_CONTEXT_ID,
      eventManager,
    );
    initialNavigationId = navigationTracker.currentNavigationId;
  });

  describe('CDP command initiated navigation', () => {
    it('should process fragment navigation', async () => {
      const navigation = navigationTracker.createPendingNavigation(SOME_URL);
      assert.equal(navigation.url, SOME_URL);
      assert.equal(navigationTracker.url, INITIAL_URL);
      navigationTracker.navigationCommandFinished(navigation, undefined);

      // Assert navigation is not finished.
      await assertNoNavigationEvents();
      assert.isFalse(navigation.started.isFinished);
      assert.isFalse(navigation.finished.isFinished);
      // Fragment navigation should not update the current navigation.
      assert.equal(navigationTracker.currentNavigationId, initialNavigationId);

      navigationTracker.navigatedWithinDocument(SOME_URL, 'fragment');

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.FragmentNavigated,
        navigation.navigationId,
        SOME_URL,
      );
      assert.isTrue(navigation.started.isFinished);
      assert.equal(
        navigation.finished.result,
        ChromiumBidi.BrowsingContext.EventNames.FragmentNavigated,
      );
      // Fragment navigation should not update the current navigation.
      assert.equal(navigationTracker.currentNavigationId, initialNavigationId);
      assert.equal(navigationTracker.url, SOME_URL);
    });

    describe('cross-document navigation', () => {
      it('started', async () => {
        const navigation = navigationTracker.createPendingNavigation(SOME_URL);

        await assertNoNavigationEvents();
        assert.isFalse(navigation.started.isFinished);
        assert.isFalse(navigation.finished.isFinished);
        assert.equal(navigation.url, SOME_URL);
        assert.equal(navigationTracker.url, INITIAL_URL);
        assert.equal(
          navigationTracker.currentNavigationId,
          initialNavigationId,
        );

        navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
          navigation.navigationId,
          ANOTHER_URL,
        );
        assert.isTrue(navigation.started.isFinished);
        assert.isFalse(navigation.finished.isFinished);
        assert.equal(navigation.url, ANOTHER_URL);
        assert.equal(navigationTracker.url, INITIAL_URL);
        assert.equal(
          navigationTracker.currentNavigationId,
          navigation.navigationId,
        );

        navigationTracker.navigationCommandFinished(navigation, LOADER_ID);

        await assertNoNavigationEvents();
        assert.isTrue(navigation.started.isFinished);
        assert.isFalse(navigation.finished.isFinished);
        assert.equal(navigation.url, ANOTHER_URL);
        assert.equal(navigationTracker.url, ANOTHER_URL);
        assert.equal(
          navigationTracker.currentNavigationId,
          navigation.navigationId,
        );

        navigationTracker.loadPageEvent(ANOTHER_LOADER_ID);

        await assertNoNavigationEvents();
        assert.isFalse(navigation.finished.isFinished);

        navigationTracker.loadPageEvent(LOADER_ID);

        await assertNoNavigationEvents();
        assert.equal(
          navigation.finished.result,
          ChromiumBidi.BrowsingContext.EventNames.Load,
        );
      });
    });

    it('aborted by script-initiated navigation', async () => {
      const navigation = navigationTracker.createPendingNavigation(SOME_URL);
      navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
        navigation.navigationId,
        ANOTHER_URL,
      );

      navigationTracker.frameRequestedNavigation(YET_ANOTHER_URL);

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.NavigationAborted,
        navigation.navigationId,
        ANOTHER_URL,
      );

      assert.isTrue(navigation.started.isFinished);
      assert.equal(
        navigation.finished.result,
        ChromiumBidi.BrowsingContext.EventNames.NavigationAborted,
      );
      assert.equal(navigationTracker.currentNavigationId, initialNavigationId);
      assert.equal(navigationTracker.url, INITIAL_URL);
    });

    it('failed command', async () => {
      const navigation = navigationTracker.createPendingNavigation(SOME_URL);
      navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
        navigation.navigationId,
        ANOTHER_URL,
      );

      navigationTracker.failNavigation(navigation);

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.NavigationFailed,
        navigation.navigationId,
        ANOTHER_URL,
      );

      assert.isTrue(navigation.started.isFinished);
      assert.equal(
        navigation.finished.result,
        ChromiumBidi.BrowsingContext.EventNames.NavigationFailed,
      );
      assert.equal(
        navigationTracker.currentNavigationId,
        navigation.navigationId,
      );
      assert.equal(navigationTracker.url, INITIAL_URL);
    });

    it('failed network', async () => {
      const navigation = navigationTracker.createPendingNavigation(SOME_URL);
      navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
        navigation.navigationId,
        ANOTHER_URL,
      );

      navigationTracker.networkLoadingFailed({requestId: LOADER_ID} as any);

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.NavigationFailed,
        navigation.navigationId,
        ANOTHER_URL,
      );

      assert.isTrue(navigation.started.isFinished);
      assert.equal(
        navigation.finished.result,
        ChromiumBidi.BrowsingContext.EventNames.NavigationFailed,
      );
      assert.equal(
        navigationTracker.currentNavigationId,
        navigation.navigationId,
      );
      assert.equal(navigationTracker.url, INITIAL_URL);
    });
  });

  describe('Renderer initiated navigation', () => {
    it('should process fragment navigation', async () => {
      navigationTracker.navigatedWithinDocument(SOME_URL, 'fragment');

      await assertNavigationEvent(
        ChromiumBidi.BrowsingContext.EventNames.FragmentNavigated,
        sinon.match.any,
        SOME_URL,
      );

      assert.equal(navigationTracker.currentNavigationId, initialNavigationId);
      assert.equal(navigationTracker.url, SOME_URL);
    });

    describe('cross-document navigation', () => {
      it('started', async () => {
        navigationTracker.frameRequestedNavigation(SOME_URL);

        await assertNoNavigationEvents();
        assert.equal(
          navigationTracker.currentNavigationId,
          initialNavigationId,
        );
        assert.equal(navigationTracker.url, INITIAL_URL);

        navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
          sinon.match.any,
          ANOTHER_URL,
        );

        assert.notEqual(
          navigationTracker.currentNavigationId,
          initialNavigationId,
        );
        assert.equal(navigationTracker.url, INITIAL_URL);

        navigationTracker.frameNavigated(YET_ANOTHER_URL, LOADER_ID);

        await assertNoNavigationEvents();
        assert.equal(navigationTracker.url, YET_ANOTHER_URL);

        navigationTracker.loadPageEvent(LOADER_ID);

        await assertNoNavigationEvents();
      });

      it('aborted by script-initiated navigation', async () => {
        navigationTracker.frameRequestedNavigation(SOME_URL);

        await assertNoNavigationEvents();
        assert.equal(
          navigationTracker.currentNavigationId,
          initialNavigationId,
        );
        assert.equal(navigationTracker.url, INITIAL_URL);

        navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
          sinon.match.any,
          ANOTHER_URL,
        );

        navigationTracker.frameRequestedNavigation(YET_ANOTHER_URL);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationAborted,
          sinon.match.any,
          ANOTHER_URL,
        );
        assert.equal(
          navigationTracker.currentNavigationId,
          initialNavigationId,
        );
        assert.equal(navigationTracker.url, INITIAL_URL);
      });

      it('aborted by command navigation', async () => {
        navigationTracker.frameRequestedNavigation(SOME_URL);
        navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
          sinon.match.any,
          ANOTHER_URL,
        );

        navigationTracker.createPendingNavigation(YET_ANOTHER_URL);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationAborted,
          sinon.match.any,
          ANOTHER_URL,
        );
        assert.equal(
          navigationTracker.currentNavigationId,
          initialNavigationId,
        );
        assert.equal(navigationTracker.url, INITIAL_URL);
      });

      it('failed network', async () => {
        navigationTracker.frameRequestedNavigation(SOME_URL);
        navigationTracker.frameStartedNavigating(ANOTHER_URL, LOADER_ID);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationStarted,
          sinon.match.any,
          ANOTHER_URL,
        );

        navigationTracker.networkLoadingFailed({requestId: LOADER_ID} as any);

        await assertNavigationEvent(
          ChromiumBidi.BrowsingContext.EventNames.NavigationFailed,
          sinon.match.any,
          ANOTHER_URL,
        );
        assert.notEqual(
          navigationTracker.currentNavigationId,
          initialNavigationId,
        );
        assert.equal(navigationTracker.url, INITIAL_URL);
      });
    });
  });
});
