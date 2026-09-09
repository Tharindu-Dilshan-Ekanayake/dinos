/**
 * Wrapper around the Bloxity Legion SDK (`window.Legion.SDK`), loaded from a
 * third-party `<script async>` in index.html.
 *
 * `async` means the script can finish loading at any point after this module
 * runs - or never, if the host is unreachable - so nothing here can assume
 * `window.Legion` exists yet. `initBloxity()` polls for it with a bounded
 * timeout and every other export guards on the SDK actually being present,
 * falling back to a safe no-op/null/false/resolved-null. That is the same
 * "optional, degrades gracefully" shape systems/leaderboard.js and
 * systems/matchmaking.js already use when their own server is unset or
 * unreachable: the game must stay fully playable offline.
 *
 * This module never touches useGameStore or React - it stays a leaf module
 * like matchmaking.js/leaderboard.js. All cross-module wiring (settings onto
 * store fields, scene changes onto game.gameplayStart/End, etc.) lives in
 * main.jsx, exactly where the equivalent audio/persistence wiring already
 * lives today.
 *
 * The avatar API below is implemented for spec completeness - getters,
 * setters, the customizer toggles - but nothing in this app ever renders an
 * equipped item in 3D. DinoModel.jsx builds a fixed procedural dinosaur (see
 * data/evolutions.js - every tier's `model` is null) with no humanoid rig or
 * equip slots to hang a hat or a backpack on. The only avatar data actually
 * used anywhere is `user.pfp`, shown as a flat <img> portrait - see
 * components/BloxityAccount.jsx.
 */

const GAME_SLUG = import.meta.env.VITE_BLOXITY_GAME_SLUG ?? 'dino-evolution-clicker'

/** How often to check for `window.Legion` while the script is still loading. */
const POLL_INTERVAL_MS = 100
/** How long to wait before giving up and running fully offline. */
const POLL_TIMEOUT_MS = 6000

let sdk = null
let initStarted = false
/** null | 'timeout' | 'init_threw' - purely diagnostic, nothing branches on it. */
let initError = null

/** Every settings key the spec documents, in the order it documents them. */
export const BLOXITY_SETTINGS_KEYS = [
  'master_volume',
  'music_volume',
  'graphics_quality',
  'show_fps',
  'camera_sensitivity',
  'enable_chat',
  'fullscreen',
  'background_transparency',
]

/*
 * The spec documents these as each key's default *on the portal side*:
 * master_volume "80", music_volume "80", graphics_quality "High",
 * show_fps "false", camera_sensitivity "1", enable_chat "true",
 * fullscreen "false", background_transparency "0.9".
 *
 * None of that seeds `settingsChannel` below - it starts empty. Seeding it
 * with the SDK's defaults would fire main.jsx's settings subscriber with
 * real-looking values the instant this module loads, silently overwriting
 * this game's own defaults (e.g. `masterVolume: 100` in useGameStore.js)
 * even when the SDK never shows up at all. Starting empty, plus main.jsx's
 * `if (settings.key !== undefined)` guards, means nothing here is ever
 * applied until `wireSettings()` reports an actual value from a real SDK.
 */

/* ------------------------------------------------------------- subscribers */

/**
 * One `Set` per subscribable concern, each with a `subscribe*` that calls the
 * new subscriber immediately with the current value and again on every
 * change - the exact shape systems/matchmaking.js's `subscribeMatchmaking`
 * and systems/leaderboard.js's `subscribeLeaderboard` already use, and the
 * one `Legion.SDK.auth.onUserChanged` itself documents ("fires immediately
 * with current state, then on every login/logout").
 */
function makeChannel(initial) {
  const subscribers = new Set()
  let value = initial
  return {
    get: () => value,
    set(next) {
      value = next
      for (const fn of subscribers) fn(value)
    },
    subscribe(fn) {
      fn(value)
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
  }
}

const authChannel = makeChannel({ available: false, loggedIn: false, user: null })
const avatarChannel = makeChannel(null)
const proportionsChannel = makeChannel(null)
const settingsChannel = makeChannel({})
const playerEventSubscribers = new Set()

/* --------------------------------------------------------------------- init */

export function initBloxity() {
  if (initStarted) return
  initStarted = true
  const start = Date.now()

  const tryInit = () => {
    if (window.Legion?.SDK) {
      try {
        window.Legion.SDK.init({ gameSlug: GAME_SLUG })
      } catch (err) {
        initError = 'init_threw'
        console.warn('[bloxity] init() threw; continuing without the SDK.', err)
        return
      }
      sdk = window.Legion.SDK
      wireAuth()
      wireSettings()
      wirePlayerEvents()
      return
    }
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      initError = 'timeout'
      console.warn('[bloxity] SDK script did not load in time; running fully offline.')
      return
    }
    setTimeout(tryInit, POLL_INTERVAL_MS)
  }

  tryInit()
}

export function isBloxityAvailable() {
  return sdk !== null
}

export function getBloxityInitError() {
  return initError
}

function wireAuth() {
  authChannel.set({ available: true, loggedIn: Boolean(sdk.auth.getUser?.()), user: sdk.auth.getUser?.() ?? null })
  sdk.auth.onUserChanged((user) => {
    authChannel.set({ available: true, loggedIn: Boolean(user), user: user ?? null })
  })
}

function wireSettings() {
  // Registering a listener is also what surfaces that control in the host
  // portal's menu, so every documented key is listened to up front even
  // though two of them (music_volume, background_transparency) are never
  // consumed downstream - see useGameStore.js/main.jsx for why.
  for (const key of BLOXITY_SETTINGS_KEYS) {
    sdk.settings.listen(key, (value) => {
      settingsChannel.set({ ...settingsChannel.get(), [key]: value })
    })
  }
  sdk.settings.triggerAll?.()
}

function wirePlayerEvents() {
  sdk.player.onEvent((event, data) => {
    for (const handler of playerEventSubscribers) handler(event, data)
  })
}

/* -------------------------------------------------------------------- auth */

export function subscribeBloxityAuth(fn) {
  return authChannel.subscribe(fn)
}

export function getBloxityAuthState() {
  return authChannel.get()
}

export function showBloxityAuthPopup() {
  if (!sdk) return Promise.resolve(null)
  return sdk.auth.showAuthPopup()
}

export function logoutBloxity() {
  if (!sdk) return
  sdk.auth.logout()
}

export function authenticateBloxityWithServer(url) {
  if (!sdk) return Promise.resolve(null)
  return sdk.auth.authenticateWithServer(url)
}

/* ------------------------------------------------------------------ avatar */

const NOT_EQUIPPED = new Set([null, undefined, '', '-1', 'undefined'])

/** True when an equipped-slot id actually names something to load. */
export function isBloxitySlotEquipped(id) {
  return !NOT_EQUIPPED.has(id)
}

export function getBloxityEquipped() {
  if (!sdk) return null
  return sdk.avatar.getEquipped()
}

export function getBloxityProportions() {
  if (!sdk) return null
  return sdk.avatar.getProportions()
}

export function setBloxityProportions(partial) {
  if (!sdk) return Promise.resolve(null)
  return sdk.avatar.setProportions(partial)
}

export function resetBloxityProportions() {
  if (!sdk) return Promise.resolve(null)
  return sdk.avatar.resetProportions()
}

export function subscribeBloxityAvatar(fn) {
  if (sdk) avatarChannel.set(sdk.avatar.getEquipped())
  const unsubscribe = avatarChannel.subscribe(fn)
  if (sdk) {
    const off = sdk.avatar.onAvatarChanged((equipped) => avatarChannel.set(equipped))
    return () => {
      unsubscribe()
      off?.()
    }
  }
  return unsubscribe
}

export function subscribeBloxityProportions(fn) {
  if (sdk) proportionsChannel.set(sdk.avatar.getProportions())
  const unsubscribe = proportionsChannel.subscribe(fn)
  if (sdk) {
    const off = sdk.avatar.onProportionsChanged((proportions) => proportionsChannel.set(proportions))
    return () => {
      unsubscribe()
      off?.()
    }
  }
  return unsubscribe
}

export function showAvatarCustomizer() {
  sdk?.avatar.showCustomizer()
}
export function hideAvatarCustomizer() {
  sdk?.avatar.hideCustomizer()
}
export function toggleAvatarCustomizer() {
  sdk?.avatar.toggleCustomizer()
}
export function isAvatarCustomizerOpen() {
  return sdk ? sdk.avatar.isCustomizerOpen() : false
}

/* ------------------------------------------------------------------ social */

export function getBloxityFriends() {
  if (!sdk) return Promise.resolve([])
  return sdk.social.getFriends()
}

/** Per spec: the room must be current before the invite is sent. */
export function inviteBloxityFriend(userId, roomId) {
  if (!sdk) return Promise.resolve(false)
  if (roomId !== undefined) sdk.game.updateRoom(roomId)
  return sdk.social.inviteFriend(userId)
}

export function getBloxityInviteLink(options) {
  if (!sdk) return ''
  return sdk.social.getInviteFriendsLink(options)
}

export function sendBloxityFriendRequest(userId) {
  if (!sdk) return Promise.resolve({ success: false, error: 'sdk_unavailable' })
  return sdk.social.sendFriendRequest(userId)
}

/* ---------------------------------------------------------------- settings */

export function subscribeBloxitySettings(fn) {
  return settingsChannel.subscribe(fn)
}

export function getBloxitySettings() {
  return settingsChannel.get()
}

export function getBloxitySetting(key) {
  return settingsChannel.get()[key]
}

/* ---------------------------------------------------------- game lifecycle */

export function bloxityLoadingStep(text) {
  sdk?.game.loadingStep(text)
}
export function bloxityLoadingEnd() {
  sdk?.game.loadingEnd()
}
export function bloxityGameplayStart() {
  sdk?.game.gameplayStart()
}
export function bloxityGameplayEnd() {
  sdk?.game.gameplayEnd()
}
export function bloxityUpdateRoom(roomId, partyId) {
  sdk?.game.updateRoom(roomId, partyId)
}
export function bloxityPlayerJoined(username) {
  sdk?.game.playerJoined(username)
}
export function bloxityPlayerInRoom(username) {
  sdk?.game.playerInRoom(username)
}

/* ------------------------------------------------------------ player events */

export function subscribeBloxityPlayerEvent(handler) {
  playerEventSubscribers.add(handler)
  return () => playerEventSubscribers.delete(handler)
}

/* ------------------------------------------------------------------- portal */

export function isBloxityEmbedded() {
  return sdk ? sdk.portal.isEmbeddedInLegion() : false
}
export function isBloxityInIframe() {
  return sdk ? sdk.portal.isInIframe() : false
}
export function bloxityShowMenu() {
  sdk?.portal.showMenu(true)
}
export function bloxityRequestFullscreen() {
  sdk?.portal.requestFullscreen()
}
export function bloxityExitFullscreen() {
  sdk?.portal.exitFullscreen()
}

/* ---------------------------------------------------------------------- api */

/** Thin, guarded passthrough to the SDK's own authenticated fetch wrapper. */
export const bloxityApi = {
  get: (path) => (sdk ? sdk.api.get(path) : Promise.resolve(null)),
  post: (path, body) => (sdk ? sdk.api.post(path, body) : Promise.resolve(null)),
  patch: (path, body) => (sdk ? sdk.api.patch(path, body) : Promise.resolve(null)),
  delete: (path) => (sdk ? sdk.api.delete(path) : Promise.resolve(null)),
}

/* ---------------------------------------------------------------------- bux */

/**
 * `sku` only - never a price. The server-side catalogue (keyed by gameSlug)
 * is the only place a price is allowed to live; see
 * server/src/bloxity/webhook.stub.js for the fulfillment contract this
 * eventually calls back into.
 */
export function requestBloxityPurchase(sku, metadata) {
  if (!sdk) return Promise.resolve({ success: false, error: 'sdk_unavailable' })
  return sdk.bux.requestPurchase(sku, metadata)
}

export function getBloxityBuxBalance() {
  if (!sdk) return Promise.resolve(0)
  return sdk.bux.getBalance()
}
