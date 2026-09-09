import { useEffect, useState } from 'react'
import { BUX_SKUS } from '../data/buxSkus.js'
import { getBloxityBuxBalance, requestBloxityPurchase } from '../systems/bloxity.js'

/**
 * The Bux (Bloxity's own currency) shop - deliberately separate from the
 * in-game 🏆 wins economy (UpgradePanel.jsx) both visually (cyan, not the
 * usual coin colours) and functionally: buying here never touches `wins` or
 * grants anything client-side. Fulfilment happens server-to-server via the
 * webhook documented at server/src/bloxity/webhook.stub.js - a client
 * "success" here can't be trusted to hand out the item on its own, so this
 * only ever shows a confirmation, never mutates game state.
 *
 * Mirrors Leaderboard.jsx's shape: the tile button and its popover live in
 * one self-contained component taking `open`/`onToggle`, so it plugs into
 * UIOverlay.jsx's existing mutual-exclusion group unchanged.
 */
export default function BuxShop({ open, onToggle }) {
  const [balance, setBalance] = useState(null)
  const [pending, setPending] = useState(null)
  const [message, setMessage] = useState('')

  const refreshBalance = () => {
    getBloxityBuxBalance().then(setBalance)
  }

  useEffect(() => {
    if (open) refreshBalance()
  }, [open])

  const buy = async (sku) => {
    setPending(sku)
    setMessage('')
    const result = await requestBloxityPurchase(sku)
    setPending(null)
    if (result?.success) {
      setMessage('Purchase complete - it will apply once the server confirms it.')
      refreshBalance()
    } else {
      setMessage(result?.error || 'Purchase did not go through.')
    }
  }

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        aria-label="Bux Shop"
        className="tile arcade-cyan h-[5.2rem] w-full"
        onPointerDown={(e) => {
          e.stopPropagation()
          onToggle(!open)
        }}
      >
        <span className="tile-icon pb-4 text-4xl">💎</span>
        <span className="tile-label text-[0.82rem]">Bux</span>
      </button>

      {open && (
        <div
          className="arcade-panel absolute right-0 top-full mt-2 w-64 animate-slide-up p-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="hud-label">Bux Shop</span>
            <span className="text-[11px] font-bold text-cyan-300">
              {balance === null ? '…' : `💎 ${balance}`}
            </span>
          </div>

          <ul className="mt-2 space-y-1.5">
            {BUX_SKUS.map((item) => (
              <li
                key={item.sku}
                className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5 text-[11px]"
              >
                <span className="flex items-center gap-1.5 font-semibold text-white/85">
                  <span>{item.icon}</span>
                  {item.name}
                </span>
                <button
                  type="button"
                  disabled={pending === item.sku}
                  className="rounded bg-cyan-500/80 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-cyan-400 disabled:opacity-50"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    buy(item.sku)
                  }}
                >
                  {pending === item.sku ? '…' : 'Buy'}
                </button>
              </li>
            ))}
          </ul>

          {message && <p className="mt-2 text-[10px] text-white/60">{message}</p>}
        </div>
      )}
    </div>
  )
}
