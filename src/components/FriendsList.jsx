import { useState } from 'react'
import { getBloxityInviteLink, inviteBloxityFriend } from '../systems/bloxity.js'
import { getMatchmakingState } from '../systems/matchmaking.js'
import { useBloxityFriends } from '../systems/useBloxity.js'

const STATUS_STYLES = {
  online: 'bg-emerald-400',
  'in-game': 'bg-sky-400',
  away: 'bg-amber-400',
  offline: 'bg-white/30',
}

/**
 * Friends + invites, rendered inside BloxityAccount.jsx's popover.
 *
 * `getFriends()` is a one-shot Promise (see useBloxityFriends), so this
 * refetches every time the popover opens rather than holding a live
 * subscription - there is no `onFriendsChanged` in the spec to subscribe to.
 */
export default function FriendsList({ open }) {
  const { friends, loading } = useBloxityFriends(open)
  const [copied, setCopied] = useState(false)

  const invite = (friend) => {
    // Per spec: the room must be current before the invite is sent.
    const roomId = getMatchmakingState().lobbyId ?? ''
    inviteBloxityFriend(friend._id, roomId)
  }

  const copyInviteLink = async () => {
    const link = getBloxityInviteLink({ roomId: getMatchmakingState().lobbyId ?? undefined })
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard permission denied - the link itself already logged below is enough */
      console.info('[bloxity] invite link:', link)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="hud-label">Friends</span>
        <button
          type="button"
          className="text-[10px] font-bold text-sky-300 hover:text-sky-200"
          onPointerDown={(e) => {
            e.stopPropagation()
            copyInviteLink()
          }}
        >
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </div>

      {loading && <p className="mt-2 text-[11px] text-white/50">Loading…</p>}

      {!loading && friends.length === 0 && (
        <p className="mt-2 text-[11px] text-white/50">No friends yet.</p>
      )}

      {!loading && friends.length > 0 && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {friends.map((friend) => (
            <li
              key={friend._id}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-[11px]"
            >
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  STATUS_STYLES[friend.presence?.status] ?? STATUS_STYLES.offline
                }`}
              />
              <span className="flex-1 truncate font-semibold text-white/85">
                {friend.displayName || friend.username}
              </span>
              <button
                type="button"
                className="rounded bg-sky-500/80 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-sky-400"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  invite(friend)
                }}
              >
                Invite
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
