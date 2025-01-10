/**
 * Copyright 2022 Google LLC.
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {BidiPlusChannel} from '../../../protocol/chromium-bidi.js';
import {
  type BrowsingContext,
  ChromiumBidi,
  InvalidArgumentException,
  NoSuchFrameException,
} from '../../../protocol/protocol.js';
import {uuidv4} from '../../../utils/uuid.js';
import type {BrowsingContextStorage} from '../context/BrowsingContextStorage.js';

/**
 * Returns the cartesian product of the given arrays.
 *
 * Example:
 *   cartesian([1, 2], ['a', 'b']); => [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']]
 */
export function cartesianProduct(...a: any[][]) {
  return a.reduce((a: unknown[], b: unknown[]) =>
    a.flatMap((d) => b.map((e) => [d, e].flat())),
  );
}

/** Expands "AllEvents" events into atomic events. */
export function unrollEvents(
  events: ChromiumBidi.EventNames[],
): ChromiumBidi.EventNames[] {
  const allEvents = new Set<ChromiumBidi.EventNames>();

  function addEvents(events: ChromiumBidi.EventNames[]) {
    for (const event of events) {
      allEvents.add(event);
    }
  }

  for (const event of events) {
    switch (event) {
      case ChromiumBidi.BiDiModule.Bluetooth:
        addEvents(Object.values(ChromiumBidi.Bluetooth.EventNames));
        break;
      case ChromiumBidi.BiDiModule.BrowsingContext:
        addEvents(Object.values(ChromiumBidi.BrowsingContext.EventNames));
        break;
      case ChromiumBidi.BiDiModule.Log:
        addEvents(Object.values(ChromiumBidi.Log.EventNames));
        break;
      case ChromiumBidi.BiDiModule.Network:
        addEvents(Object.values(ChromiumBidi.Network.EventNames));
        break;
      case ChromiumBidi.BiDiModule.Script:
        addEvents(Object.values(ChromiumBidi.Script.EventNames));
        break;
      default:
        allEvents.add(event);
    }
  }

  return [...allEvents.values()];
}

export type Subscription = {
  id: string;
  // Empty set means a global subscription.
  topLevelTraversableIds: Set<BrowsingContext.BrowsingContext>;
  // Never empty.
  eventNames: Set<ChromiumBidi.EventNames>;
  channel: BidiPlusChannel;
};

export class SubscriptionManager {
  #subscriptions: Subscription[] = [];
  #browsingContextStorage: BrowsingContextStorage;

  constructor(browsingContextStorage: BrowsingContextStorage) {
    this.#browsingContextStorage = browsingContextStorage;
  }

  getChannelsSubscribedToEvent(
    eventName: ChromiumBidi.EventNames,
    contextId: BrowsingContext.BrowsingContext,
  ): BidiPlusChannel[] {
    const channels = new Set<BidiPlusChannel>();

    for (const subscription of this.#subscriptions) {
      if (this.#isSubscribedTo(subscription, eventName, contextId)) {
        channels.add(subscription.channel);
      }
    }

    return Array.from(channels);
  }

  getChannelsSubscribedToEventGlobally(
    eventName: ChromiumBidi.EventNames,
  ): BidiPlusChannel[] {
    const channels = new Set<BidiPlusChannel>();

    for (const subscription of this.#subscriptions) {
      if (this.#isSubscribedTo(subscription, eventName)) {
        channels.add(subscription.channel);
      }
    }

    return Array.from(channels);
  }

  #isSubscribedTo(
    subscription: Subscription,
    moduleOrEvent: ChromiumBidi.EventNames,
    contextId?: BrowsingContext.BrowsingContext,
  ): boolean {
    let includesEvent = false;
    for (const eventName of subscription.eventNames) {
      // This also covers the `cdp` case where
      // we don't unroll the event names
      if (
        // Event explicitly subscribed
        eventName === moduleOrEvent ||
        // Event subscribed via module
        eventName === moduleOrEvent.split('.').at(0) ||
        // Event explicitly subscribed compared to module
        eventName.split('.').at(0) === moduleOrEvent
      ) {
        includesEvent = true;
        break;
      }
    }

    if (!includesEvent) {
      return false;
    }

    // global subscription.
    if (subscription.topLevelTraversableIds.size === 0) {
      return true;
    }

    const topLevelContext = contextId
      ? this.#browsingContextStorage.findTopLevelContextId(contextId)
      : null;

    if (
      topLevelContext !== null &&
      subscription.topLevelTraversableIds.has(topLevelContext)
    ) {
      return true;
    }

    return false;
  }

  isSubscribedTo(
    moduleOrEvent: ChromiumBidi.EventNames,
    contextId: BrowsingContext.BrowsingContext,
  ): boolean {
    for (const subscription of this.#subscriptions) {
      if (this.#isSubscribedTo(subscription, moduleOrEvent, contextId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Subscribes to event in the given context and channel.
   * @param {EventNames} event
   * @param {BrowsingContext.BrowsingContext | null} contextId
   * @param {BidiPlusChannel} channel
   * @return {SubscriptionItem[]} List of
   * subscriptions. If the event is a whole module, it will return all the specific
   * events. If the contextId is null, it will return all the top-level contexts which were
   * not subscribed before the command.
   */
  subscribe(
    eventNames: ChromiumBidi.EventNames[],
    contextIds: BrowsingContext.BrowsingContext[],
    channel: BidiPlusChannel,
  ): Subscription {
    // All the subscriptions are handled on the top-level contexts.
    const subscription: Subscription = {
      id: uuidv4(),
      eventNames: new Set(unrollEvents(eventNames)),
      topLevelTraversableIds: new Set(
        contextIds.map((contextId) => {
          const topLevelContext =
            this.#browsingContextStorage.findTopLevelContextId(contextId);
          if (!topLevelContext) {
            throw new NoSuchFrameException(
              `Top-level navigable not found for context id ${contextId}`,
            );
          }
          return topLevelContext;
        }),
      ),
      channel,
    };
    this.#subscriptions.push(subscription);
    return subscription;
  }

  /**
   * Unsubscribes atomically from all events in the given contexts and channel.
   *
   * This is a legacy spec branch to unsubscribe by attributes.
   */
  unsubscribe(
    inputEventNames: ChromiumBidi.EventNames[],
    inputContextIds: BrowsingContext.BrowsingContext[],
    channel: BidiPlusChannel,
  ) {
    const eventNames = new Set(unrollEvents(inputEventNames));

    for (const contextId of inputContextIds) {
      // Validation that contexts exist.
      this.#browsingContextStorage.getContext(contextId);
    }
    const topLevelTraversables = new Set(
      inputContextIds.map((contextId) => {
        const topLevelContext =
          this.#browsingContextStorage.findTopLevelContextId(contextId);
        if (!topLevelContext) {
          throw new NoSuchFrameException(
            `Top-level navigable not found for context id ${contextId}`,
          );
        }
        return topLevelContext;
      }),
    );

    const isGlobalUnsubscribe = topLevelTraversables.size === 0;
    const newSubscriptions: Subscription[] = [];
    const eventsMatched = new Set<ChromiumBidi.EventNames>();
    const contextsMatched = new Set<BrowsingContext.BrowsingContext>();
    for (const subscription of this.#subscriptions) {
      if (subscription.channel !== channel) {
        newSubscriptions.push(subscription);
        continue;
      }
      // Skip subscriptions when none of the event names match.
      if (intersection(subscription.eventNames, eventNames).size === 0) {
        newSubscriptions.push(subscription);
        continue;
      }
      if (isGlobalUnsubscribe) {
        // Skip non-global subscriptions.
        if (subscription.topLevelTraversableIds.size !== 0) {
          newSubscriptions.push(subscription);
          continue;
        }
        const subscriptionEventNames = new Set(subscription.eventNames);
        for (const eventName of eventNames) {
          if (subscriptionEventNames.has(eventName)) {
            eventsMatched.add(eventName);
            subscriptionEventNames.delete(eventName);
          }
        }
        // If some events remain in the subscription, we keep it.
        if (subscriptionEventNames.size !== 0) {
          newSubscriptions.push({
            ...subscription,
            eventNames: subscriptionEventNames,
          });
        }
      } else {
        // Skip global subscriptions.
        if (subscription.topLevelTraversableIds.size === 0) {
          newSubscriptions.push(subscription);
          continue;
        }

        // Splitting context subscriptions.
        const eventMap = new Map<
          ChromiumBidi.EventNames,
          Set<BrowsingContext.BrowsingContext>
        >();
        for (const eventName of subscription.eventNames) {
          eventMap.set(eventName, new Set(subscription.topLevelTraversableIds));
        }
        for (const eventName of eventNames) {
          const eventContextSet = eventMap.get(eventName);
          if (!eventContextSet) {
            continue;
          }
          for (const toRemoveId of topLevelTraversables) {
            if (eventContextSet.has(toRemoveId)) {
              contextsMatched.add(toRemoveId);
              eventsMatched.add(eventName);
              eventContextSet.delete(toRemoveId);
            }
          }
          if (eventContextSet.size === 0) {
            eventMap.delete(eventName);
          }
        }
        for (const [eventName, remainingContextIds] of eventMap) {
          const partialSubscription: Subscription = {
            id: subscription.id,
            channel: subscription.channel,
            eventNames: new Set([eventName]),
            topLevelTraversableIds: remainingContextIds,
          };
          newSubscriptions.push(partialSubscription);
        }
      }
    }

    // If some events did not match, it is an invalid request.
    if (!equal(eventsMatched, eventNames)) {
      throw new InvalidArgumentException('No subscription found');
    }

    // If some events did not match, it is an invalid request.
    if (!isGlobalUnsubscribe && !equal(contextsMatched, topLevelTraversables)) {
      throw new InvalidArgumentException('No subscription found');
    }

    // Committing the new subscriptions.
    this.#subscriptions = newSubscriptions;
  }

  /**
   * Unsubscribes by subscriptionId.
   */
  unsubscribeById(_subscription: string) {
    // TODO: implement.
  }
}

/**
 * Replace with Set.prototype.intersection once Node 20 is dropped.
 */
function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const a of setA) {
    if (setB.has(a)) {
      result.add(a);
    }
  }
  return result;
}

/**
 * Replace with Set.prototype.difference once Node 20 is dropped.
 */
export function difference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const a of setA) {
    if (!setB.has(a)) {
      result.add(a);
    }
  }
  return result;
}

function equal<T>(setA: Set<T>, setB: Set<T>): boolean {
  if (setA.size !== setB.size) {
    return false;
  }
  for (const a of setA) {
    if (!setB.has(a)) {
      return false;
    }
  }
  return true;
}
