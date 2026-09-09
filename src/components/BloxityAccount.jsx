import { useState } from 'react'
import { useBloxityAuth } from '../systems/useBloxity.js'
import { logoutBloxity, showBloxityAuthPopup } from '../systems/bloxity.js'
import FriendsList from './FriendsList.jsx'

/**
 * The corner of the HUD that shows who is logged in via Bloxity - or a "Log
 * In" pill when nobody is. `useBloxityAuth`'s state comes straight from
 * `Legion.SDK.auth.onUserChanged`, which is the single source of truth for
 * auth state everywhere in this app (see systems/bloxity.js).
 *
 * Deliberately its own component rather than folded into SettingsMenu.jsx -
 * that file is left completely alone by this integration.
 */
export default function BloxityAccount() {
  const { available, loggedIn, user } = useBloxityAuth()
  const [open, setOpen] = useState(false)

  // No SDK loaded (offline, blocked, or the host is just unreachable) - same
  // discipline Leaderboard.jsx uses when it has nothing to show either.
  if (!available) return null

  if (!loggedIn) {
    return (
      <button
        type="button"
        className="arcade arcade-blue pointer-events-auto h-8 rounded-full px-3 text-[11px] font-bold"
        onPointerDown={(e) => {
          e.stopPropagation()
          showBloxityAuthPopup()
        }}
      >
        Log In
      </button>
    )
  }

  const name = user?.displayName || user?.username || 'Player'
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        aria-label="Account"
        className="arcade-panel flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3"
        onPointerDown={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {user?.pfp ? (
          <img src={user.pfp} alt="" className="h-6 w-6 rounded-full border border-white/30 object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold">
            {initial}
          </span>
        )}
        <span className="max-w-[6rem] truncate text-[11px] font-bold text-white/90">{name}</span>
      </button>

      {open && (
        <div
          className="arcade-panel absolute left-0 top-full z-20 mt-2 w-64 animate-slide-up p-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <FriendsList open={open} />
          <button
            type="button"
            className="mt-3 w-full rounded-lg bg-white/10 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/15"
            onPointerDown={(e) => {
              e.stopPropagation()
              logoutBloxity()
              setOpen(false)
            }}
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}
