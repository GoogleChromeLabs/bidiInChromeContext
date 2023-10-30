# Changelog

All notable changes to this project will be documented in this file.

## [0.4.33](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.32...chromium-bidi-v0.4.33) (2023-10-30)


### Features

* add network intercept continue with auth ([#1470](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1470)) ([ad3a95e](https://github.com/GoogleChromeLabs/chromium-bidi/commit/ad3a95edddeeb451a71cf4a1b545800b255f672a)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* addPreloadScript respects new contexts ([#1478](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1478)) ([b0e55fa](https://github.com/GoogleChromeLabs/chromium-bidi/commit/b0e55fa613dd4b6f9e3670bcff6da82ce44f4622))
* addPreloadScripts respects contexts param for old contexts ([#1475](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1475)) ([0cdde07](https://github.com/GoogleChromeLabs/chromium-bidi/commit/0cdde074938f6cbdca8bb808891e4528a3714998))
* implement headersSize for network requests ([#1498](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1498)) ([e904ee0](https://github.com/GoogleChromeLabs/chromium-bidi/commit/e904ee0c446ca39491b29a60b9fa428541149310)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* implement network interception continue response ([#1443](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1443)) ([4515d1d](https://github.com/GoogleChromeLabs/chromium-bidi/commit/4515d1d5c96c2b310928c28ca31260c8cd5433d7)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* implement network interception provide response ([#1457](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1457)) ([1eca26e](https://github.com/GoogleChromeLabs/chromium-bidi/commit/1eca26e0c6d48e266384cdfe1f3bc7c93ebf2710)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* **logging:** pretty print received and sent bidi server messages ([#1490](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1490)) ([45fd24e](https://github.com/GoogleChromeLabs/chromium-bidi/commit/45fd24e483deaa2e85819e2bf824127010c9b421))
* **network intercept:** implement continue with auth (cont.) ([#1484](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1484)) ([7cc9358](https://github.com/GoogleChromeLabs/chromium-bidi/commit/7cc935885d1b44cbf34d52f5d86b459d11befcd8)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* **network intercept:** specify BeforeRequestSent whenever AuthRequi… ([#1494](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1494)) ([22eafee](https://github.com/GoogleChromeLabs/chromium-bidi/commit/22eafee8d0f4e55d74a451732b5d217c187db438)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* network request: prioritize response status code over extraInfo ([#1466](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1466)) ([d1f3302](https://github.com/GoogleChromeLabs/chromium-bidi/commit/d1f33024cda1bceecf307c2a19edcddcd5f7bec9)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* **network:** emit `responseStarted` event ("AND") ([#1497](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1497)) ([46220b7](https://github.com/GoogleChromeLabs/chromium-bidi/commit/46220b7596803ea5a5c1925f343b072a0e9f0e4d)), closes [#765](https://github.com/GoogleChromeLabs/chromium-bidi/issues/765)


### Bug Fixes

* Add `window.setSelfTargetId` for backward compatibility with chrome driver ([#1461](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1461)) ([fe98f94](https://github.com/GoogleChromeLabs/chromium-bidi/commit/fe98f94a8e9bed5253fb69485d62a47842bf5992))

## [0.4.32](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.31...chromium-bidi-v0.4.32) (2023-10-16)


### Features

* add quality for `webp` ([#1426](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1426)) ([d514bf9](https://github.com/GoogleChromeLabs/chromium-bidi/commit/d514bf96bedd1b53473abb212638110066831efb))
* implement device pixel ratio changes ([#1422](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1422)) ([49f6dee](https://github.com/GoogleChromeLabs/chromium-bidi/commit/49f6dee572f67992d87ca4ec60e49350a8467ff2))
* implement document origin screenshots ([#1427](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1427)) ([b952297](https://github.com/GoogleChromeLabs/chromium-bidi/commit/b95229776ff40f5ee7087ad4b93ff559098b8899))
* **network interception:** implement continue request ([#1331](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1331)) ([8a935b9](https://github.com/GoogleChromeLabs/chromium-bidi/commit/8a935b9c9295ceea567cabd2b696eb8fbcc53369)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* session handling refactoring. Step 1 ([#1385](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1385)) ([8fe37b9](https://github.com/GoogleChromeLabs/chromium-bidi/commit/8fe37b9f402bb2b52c585b6925dba4b15b04473a))
* unblock event queue when network events are blocked ([#1409](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1409)) ([e94f79d](https://github.com/GoogleChromeLabs/chromium-bidi/commit/e94f79d88cba8b73f2a895a31fffd87b9f03f48a))

## [0.4.31](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.30...chromium-bidi-v0.4.31) (2023-10-06)


### Bug Fixes

* part 2 of [#1391](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1391) ([#1393](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1393)) ([a875831](https://github.com/GoogleChromeLabs/chromium-bidi/commit/a8758313bf3a0f704973c749da86f01da7df4b83))

## [0.4.30](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.29...chromium-bidi-v0.4.30) (2023-10-06)


### Bug Fixes

* use 0.5 for default radiusX and radiusY ([#1391](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1391)) ([8a423d3](https://github.com/GoogleChromeLabs/chromium-bidi/commit/8a423d301981e18bcd517cc600c0b7456e029fbe))

## [0.4.29](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.28...chromium-bidi-v0.4.29) (2023-10-06)


### Features

* implement angle inputs ([#1342](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1342)) ([90933ee](https://github.com/GoogleChromeLabs/chromium-bidi/commit/90933eee8c847c15135eeb8fe8d8b01c72927e0d))
* implement network interception fail request ([#1318](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1318)) ([c5f6581](https://github.com/GoogleChromeLabs/chromium-bidi/commit/c5f658168d8eac5fc2dc851991ee825e6d5e1fbf)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)


### Bug Fixes

* mapper tab debugging logs ([#1336](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1336)) ([54ea831](https://github.com/GoogleChromeLabs/chromium-bidi/commit/54ea831451ba79c0111f1edc4f93fe1ddce0ef5d))
* round tilt values ([#1387](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1387)) ([2d4707f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/2d4707f80c3766e0d994c659510ce5402b59f6b1))
* use half the width/height for touch event radii ([#1341](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1341)) ([aa84a40](https://github.com/GoogleChromeLabs/chromium-bidi/commit/aa84a4061449a22e490791c3abad3ce1374377b4))

## [0.4.28](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.27...chromium-bidi-v0.4.28) (2023-09-20)


### Features

* handle `Fetch.requestPaused` event ([#1304](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1304)) ([5b6a579](https://github.com/GoogleChromeLabs/chromium-bidi/commit/5b6a579ed4ccab359935a6d531c623106afd3bbd)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* support redirect response ([#1313](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1313)) ([7c17942](https://github.com/GoogleChromeLabs/chromium-bidi/commit/7c179422ea2f37c9857ca93bc0879a7a6354041a))


### Bug Fixes

* restore functionality to subscribe to all CDP events ([#1301](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1301)) ([171518f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/171518f1a0d3ebc24301075183725f30570e54a8))
* separate click count by button ([#1321](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1321)) ([9ebf2ed](https://github.com/GoogleChromeLabs/chromium-bidi/commit/9ebf2ed14903ff0fb88613bdaf636c7a81526a7a))

## [0.4.27](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.26...chromium-bidi-v0.4.27) (2023-09-12)


### Features

* add get network intercepts method ([#1250](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1250)) ([57cc9e9](https://github.com/GoogleChromeLabs/chromium-bidi/commit/57cc9e992e2728257995bab4ce70ecd907208030)), closes [#1183](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1183)
* browsingContext.reload: return the navigation instead of empty ([#1255](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1255)) ([c534e0e](https://github.com/GoogleChromeLabs/chromium-bidi/commit/c534e0ed2bcf2c3f7f3213e75412bf83423b9d5b)), closes [#650](https://github.com/GoogleChromeLabs/chromium-bidi/issues/650)
* restore network redirects ([#1249](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1249)) ([5bbe93f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/5bbe93f65752f425438c5f0e67d239a62d09e890))
* throw InvalidArgument instead of UnsupportedOperation for print… ([#1280](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1280)) ([b32ea31](https://github.com/GoogleChromeLabs/chromium-bidi/commit/b32ea31ca346caacf4af673c857ab97cb1e9ba45))


### Bug Fixes

* flatten event type ([#1292](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1292)) ([8f4cd2b](https://github.com/GoogleChromeLabs/chromium-bidi/commit/8f4cd2bce395089e11a79094e9f438724fb16d71))
* replace empty string `namespaceURI` with null ([#1285](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1285)) ([93fdf47](https://github.com/GoogleChromeLabs/chromium-bidi/commit/93fdf4735d0497ee4ef92c8360a36e45ccfe93c1))

## [0.4.26](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.25...chromium-bidi-v0.4.26) (2023-09-08)


### Bug Fixes

* catch uncaught throws from #getHandleFromWindow ([#1273](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1273)) ([f41d5cf](https://github.com/GoogleChromeLabs/chromium-bidi/commit/f41d5cf1decac1e1edf811fe3f482beff67dacba))

## [0.4.25](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.24...chromium-bidi-v0.4.25) (2023-09-08)


### Bug Fixes

* unhandled promises in CDP targets ([#1270](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1270)) ([3ef5922](https://github.com/GoogleChromeLabs/chromium-bidi/commit/3ef59223aa165f0c1106fbbcfdfb8e6d3702c2ab))

## [0.4.24](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.23...chromium-bidi-v0.4.24) (2023-09-07)


### Features

* add url getter to NetworkRequest ([#1251](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1251)) ([1d12f04](https://github.com/GoogleChromeLabs/chromium-bidi/commit/1d12f04248aa27227447876fdd35cd460d915de6)), closes [#1183](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1183)
* default value for `userPromptOpened` ([#1260](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1260)) ([94b0718](https://github.com/GoogleChromeLabs/chromium-bidi/commit/94b0718f5d47391ac536aadaaf230463d62d3904))
* implement `UnableToCaptureScreenException` in browsingContext.captureScreenshot ([#1236](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1236)) ([8110918](https://github.com/GoogleChromeLabs/chromium-bidi/commit/8110918d29148797f68959ba57ef6169f09b804b))
* Network Intercept: handle special schemes ([#1224](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1224)) ([27c6ccb](https://github.com/GoogleChromeLabs/chromium-bidi/commit/27c6ccbbff2eabcf77544dd4796c37a6abca49a5)), closes [#1183](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1183)


### Bug Fixes

* reject errors instead of throwing in CDP target init ([#1267](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1267)) ([694cc8a](https://github.com/GoogleChromeLabs/chromium-bidi/commit/694cc8a56e59fc58cdca27232df90900458695bd))

## [0.4.23](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.22...chromium-bidi-v0.4.23) (2023-08-29)


### Features

* add network redirects ([#1215](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1215)) ([5de26ff](https://github.com/GoogleChromeLabs/chromium-bidi/commit/5de26ff63e1d84d0dd1e60ff79ac775874629eed))
* implement clip for `BrowsingContext.captureScreenshot` ([#1212](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1212)) ([b17379f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/b17379f58de050a898874b7053f750eb3772845a))

## [0.4.22](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.21...chromium-bidi-v0.4.22) (2023-08-24)


### Features

* **add network intercept:** parse URL patterns ([#1186](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1186)) ([977fff2](https://github.com/GoogleChromeLabs/chromium-bidi/commit/977fff21245e02313d5c1dc115c0ece24164bc47))


### Bug Fixes

* no-op for trivial pen and touch movements ([#1205](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1205)) ([005526b](https://github.com/GoogleChromeLabs/chromium-bidi/commit/005526bbc1053dbde2861639514869ff8cf17a32))
* remove deep-serialization checks ([#1190](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1190)) ([df45817](https://github.com/GoogleChromeLabs/chromium-bidi/commit/df4581786200216655fae00e45f926fbf41f90c8))
* remove sandbox check ([#1202](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1202)) ([8c97280](https://github.com/GoogleChromeLabs/chromium-bidi/commit/8c9728013ff55b637c9921a678e172e45b8894e3))

## [0.4.21](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.20...chromium-bidi-v0.4.21) (2023-08-21)


### Features

* scaffold network request interception ([#1050](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1050)) ([667186a](https://github.com/GoogleChromeLabs/chromium-bidi/commit/667186af58104e502db41703c8d26bb17dcfabc5)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)


### Bug Fixes

* filter only sent cookies ([#1184](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1184)) ([22c043b](https://github.com/GoogleChromeLabs/chromium-bidi/commit/22c043b3e09082bc42fc0dc562c0c52c8bb826a8)), closes [#1011](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1011)
* ignore cert errors in the test driver ([#1161](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1161)) ([d0de039](https://github.com/GoogleChromeLabs/chromium-bidi/commit/d0de03950ba4aa20d7273cea9f13065be9fbf2cd)), closes [#1162](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1162)

## [0.4.20](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.19...chromium-bidi-v0.4.20) (2023-08-01)


### Features

* implement `browser.close` ([#1116](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1116)) ([a715559](https://github.com/GoogleChromeLabs/chromium-bidi/commit/a71555990c3ccc505ff6fe9bcc3dab9276877244))
* **script:** implement user activation ([#1105](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1105)) ([2408d7f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/2408d7fdd37cb535b95227395a06222e8e718bd5))


### Bug Fixes

* don't publish `.tsbuildinfo` ([#1106](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1106)) ([4b1945f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/4b1945f390c0b257925c248b044c9cec56d50942))
* use Result passing to prevent Unhandled promise rejections ([#1112](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1112)) ([e0dc19f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/e0dc19f1dd22d7484387656089ce5819b096aa76))

## [0.4.19](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.18...chromium-bidi-v0.4.19) (2023-07-25)


### Bug Fixes

* Deferred no multiple resolved/rejects ([#1076](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1076)) ([5657baf](https://github.com/GoogleChromeLabs/chromium-bidi/commit/5657baf4ff6eee308d926402faab20ba99b5ec90))

## [0.4.18](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.17...chromium-bidi-v0.4.18) (2023-07-21)


### Features

* implement browsingContext.activate ([#1002](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1002)) ([22e2417](https://github.com/GoogleChromeLabs/chromium-bidi/commit/22e24175df46163303d0b646ede81bb9ab034d8d))
* implement drag n' drop ([#1006](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1006)) ([6443045](https://github.com/GoogleChromeLabs/chromium-bidi/commit/6443045a41675a653a912a06442dfc1ed4e4be72))
* **print:** throw unsupported operation when content area is empty ([#992](https://github.com/GoogleChromeLabs/chromium-bidi/issues/992)) ([71a8b5c](https://github.com/GoogleChromeLabs/chromium-bidi/commit/71a8b5c74950db19ccc6e75000c843b5156ac49b)), closes [#518](https://github.com/GoogleChromeLabs/chromium-bidi/issues/518)
* refactor scripts and realms and fix generator serialization ([#1013](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1013)) ([73ea6f0](https://github.com/GoogleChromeLabs/chromium-bidi/commit/73ea6f08a17100a3259fcb7c9ccb686efca8c3e5)), closes [#562](https://github.com/GoogleChromeLabs/chromium-bidi/issues/562)
* support iterator serialization ([#1042](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1042)) ([9dff121](https://github.com/GoogleChromeLabs/chromium-bidi/commit/9dff121dcb34156330151512d552c5c815a45449))


### Bug Fixes

* don't hold finished requests in memory ([#1058](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1058)) ([f15163a](https://github.com/GoogleChromeLabs/chromium-bidi/commit/f15163ac730d8e4a6cee2410c7e0619f8bf2374f))
* NavigationStarted Event for sub-frames ([#1009](https://github.com/GoogleChromeLabs/chromium-bidi/issues/1009)) ([c4841f8](https://github.com/GoogleChromeLabs/chromium-bidi/commit/c4841f86aa3cbd3b9d9eca5ae05e1bde94ef434b))

## [0.4.17](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.16...chromium-bidi-v0.4.17) (2023-07-07)


### Features

* `addScriptToEvaluateOnNewDocument`: run immediately ([#919](https://github.com/GoogleChromeLabs/chromium-bidi/issues/919)) ([cfba71f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/cfba71f2285ecda7f5ee52a525c2f5fea1d35150))
* add Dialog (user prompt) handling ([#924](https://github.com/GoogleChromeLabs/chromium-bidi/issues/924)) ([474a3fa](https://github.com/GoogleChromeLabs/chromium-bidi/commit/474a3fa1b96482f7b38f3e72c071a3956165e888))
* preload scripts: support sandboxes ([#978](https://github.com/GoogleChromeLabs/chromium-bidi/issues/978)) ([ef65951](https://github.com/GoogleChromeLabs/chromium-bidi/commit/ef65951a0ab29a7ff877dd680d2c53b9e7cd407e)), closes [#293](https://github.com/GoogleChromeLabs/chromium-bidi/issues/293)
* protocol: add WindowProxyProperties ([#952](https://github.com/GoogleChromeLabs/chromium-bidi/issues/952)) ([0deef4b](https://github.com/GoogleChromeLabs/chromium-bidi/commit/0deef4bf59d68e61b7e196e751f416dfb19763e5))
* prototype network request interception: scaffold protocol ([#845](https://github.com/GoogleChromeLabs/chromium-bidi/issues/845)) ([1b77f94](https://github.com/GoogleChromeLabs/chromium-bidi/commit/1b77f94eb3828d711f2e63041a9388756b658f83)), closes [#644](https://github.com/GoogleChromeLabs/chromium-bidi/issues/644)
* use `maxNodeDepth` + `includeShadowTree` for serialization ([#815](https://github.com/GoogleChromeLabs/chromium-bidi/issues/815)) ([09b4fc6](https://github.com/GoogleChromeLabs/chromium-bidi/commit/09b4fc62a6a9b351fd0c4a95fabee0e355886005))
* use generated types for WebDriverBidi ([#961](https://github.com/GoogleChromeLabs/chromium-bidi/issues/961)) ([4f70209](https://github.com/GoogleChromeLabs/chromium-bidi/commit/4f702096092037263ecb1b95434972978f5ba993))


### Bug Fixes

* add stack trace to Unknown errors ([#938](https://github.com/GoogleChromeLabs/chromium-bidi/issues/938)) ([9773a8a](https://github.com/GoogleChromeLabs/chromium-bidi/commit/9773a8aedff750246950699278ec98fcad2956dd))
* Network Module clogging Processing Queue ([#964](https://github.com/GoogleChromeLabs/chromium-bidi/issues/964)) ([9366a5e](https://github.com/GoogleChromeLabs/chromium-bidi/commit/9366a5e3ad20a117063b328acbde45005eee2b6a))
* preload scripts: fully remove optional context param ([#972](https://github.com/GoogleChromeLabs/chromium-bidi/issues/972)) ([e3e7d76](https://github.com/GoogleChromeLabs/chromium-bidi/commit/e3e7d76c116350b30b3aebba54153519aeec33c0)), closes [#293](https://github.com/GoogleChromeLabs/chromium-bidi/issues/293) [#963](https://github.com/GoogleChromeLabs/chromium-bidi/issues/963)
* stop fragmentNavigated from emitting for normal navigation ([#960](https://github.com/GoogleChromeLabs/chromium-bidi/issues/960)) ([7f91b46](https://github.com/GoogleChromeLabs/chromium-bidi/commit/7f91b465af0a51787b1aaaf579aa4a0ee0362932)), closes [#955](https://github.com/GoogleChromeLabs/chromium-bidi/issues/955)
* use non-force close for BrowsingContext.close ([#939](https://github.com/GoogleChromeLabs/chromium-bidi/issues/939)) ([055126f](https://github.com/GoogleChromeLabs/chromium-bidi/commit/055126f06da7fadafdbdb0f1f945a2b42e47579f))

## [0.4.16](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.15...chromium-bidi-v0.4.16) (2023-06-28)


### Bug Fixes

* set correct text for Enter key ([#909](https://github.com/GoogleChromeLabs/chromium-bidi/issues/909)) ([ed41381](https://github.com/GoogleChromeLabs/chromium-bidi/commit/ed413819200a9b43271a362647247f97f2d719b1))

## [0.4.15](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.14...chromium-bidi-v0.4.15) (2023-06-28)


### Features

* add `browsingContext.navigationStarted'` ([#881](https://github.com/GoogleChromeLabs/chromium-bidi/issues/881)) ([db5a1cc](https://github.com/GoogleChromeLabs/chromium-bidi/commit/db5a1cc74d91286f317c22b77209fb04daa69dde))


### Bug Fixes

* allow shift with printable keys ([#906](https://github.com/GoogleChromeLabs/chromium-bidi/issues/906)) ([5ec0ba2](https://github.com/GoogleChromeLabs/chromium-bidi/commit/5ec0ba2b891238c50d08ba5fd4cece844892f5b3))
* expand viewport validation tests ([#895](https://github.com/GoogleChromeLabs/chromium-bidi/issues/895)) ([7cc5aee](https://github.com/GoogleChromeLabs/chromium-bidi/commit/7cc5aee7a11b19cf6c9d8f724caf356cbb7f1f9b)), closes [#868](https://github.com/GoogleChromeLabs/chromium-bidi/issues/868)
* use correct location for key events ([#903](https://github.com/GoogleChromeLabs/chromium-bidi/issues/903)) ([88be8e3](https://github.com/GoogleChromeLabs/chromium-bidi/commit/88be8e31f6b47780def2771baa06f7836b3d69f9))
* use correct modifiers for mouse click ([#904](https://github.com/GoogleChromeLabs/chromium-bidi/issues/904)) ([9561fff](https://github.com/GoogleChromeLabs/chromium-bidi/commit/9561fff1e1e339af6cd268e877e2a8631f018652))

## [0.4.14](https://github.com/GoogleChromeLabs/chromium-bidi/compare/chromium-bidi-v0.4.13...chromium-bidi-v0.4.14) (2023-06-27)


### Features

* add realmDestroyed event ([#877](https://github.com/GoogleChromeLabs/chromium-bidi/issues/877)) ([e4c8d96](https://github.com/GoogleChromeLabs/chromium-bidi/commit/e4c8d965efe76cfd6bb809674a20587dde0b24d4))
* **browsingContext:** implement `setViewport` ([#817](https://github.com/GoogleChromeLabs/chromium-bidi/issues/817)) ([cfd6d55](https://github.com/GoogleChromeLabs/chromium-bidi/commit/cfd6d5559fbbd846256abe64dcf965dc341ed1b5))
* make the BiDi events less "chatty" ([#892](https://github.com/GoogleChromeLabs/chromium-bidi/issues/892)) ([8c1ad46](https://github.com/GoogleChromeLabs/chromium-bidi/commit/8c1ad461148f5820d62cf8961981e781e543e7d9))

## [0.4.13]() (2023-06-20)

### Features

- Add frameNavigated event (#865)

## [0.4.12]() (2023-06-15)

### Bug Fixes

- Recover `fromCache` change (#791)
- Network response fromCache (#831)
- Screenshots failing when setViewport is used (#851)

### Features

- Adds script.realmCreated (#850)

### Testing

- Add save_pdf method for debugging (#842)

## [0.4.11]() (2023-05-30)

### Bug Fixes

- Network Module stuck if ServedFromCache is send (#773)

### Miscellaneous Tasks

- Remove global crypto (#767)
- Small fixes for network module (#785)

## [0.4.10]() (2023-05-22)

### Bug Fixes

- Layering issue with Puppeteer (#728)

### Miscellaneous Tasks

- EventEmitter should return type this (#725)

## [0.4.9]() (2023-05-12)

### Bug Fixes

- Suppress error for releasing object (#701)

### Miscellaneous Tasks

- Pin Chrome (#703)
- Auto-update Chrome (#706)
- Update pinning + browsers version (#713)
- Configure the automatic browser roll PRs (#719)

## [0.4.8]() (2023-05-08)

### Bug Fixes

- Network request respects hasExtraInfo field (#645)
- Cdp session parameter name (#649)
- Fix all add preload script validation tests by adding channels and validating them  (#679)
- Don't throw error when encountering redirects (#690)

### Miscellaneous Tasks

- Insure TypeScript work with Puppeteer (#668)

## [0.4.6]() (2023-03-24)

### Miscellaneous Tasks

- Remove console.error statement, replace with logger (#517)

### Refactor

- Refactor script evaluator (#542)

## [0.4.5]() (2023-03-01)

### Miscellaneous Tasks

- Remove +Infinity from SpecialNumber (#473)

## [0.4.4]() (2023-02-17)

### Bug Fixes

- Fix a couple of pytest issues by introducing a pytest.ini file (#426)
- Fix filename typo: Outgoind -> Outgoing (#436)
- Fix WPT README badges and rename wpt-chromedriver consistently (#447)


## [0.4.3]() (2022-12-13)

### Miscellaneous Tasks

- Sort package.json scripts (#330)

## [0.4.2]() (2022-05-06)

### Bug Fixes

- Fix mac dependency
- Fix launch.json (#3)
- Fix example (#108)

### Refactor

- Refactoring
