// useAdminNotifications — realtime popup alerts for OpsDashboard
//
// Usage (add ONE line inside OpsDashboard component):
//   import { useAdminNotifications } from '../hooks/useAdminNotifications'
//   useAdminNotifications(true)   ← call unconditionally at top of component

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const NOTIF = {
  pending:         { icon: '🚕', title: 'New Cab Request',  color: '#f5a623' },
  driver_assigned: { icon: '✅', title: 'Driver Assigned',  color: '#22c55e' },
  cancelled:       { icon: '❌', title: 'Ride Cancelled',   color: '#e74c3c' },
  completed:       { icon: '🏁', title: 'Ride Completed',   color: '#3b82f6' },
  payment_failed:  { icon: '⚠️', title: 'Payment Issue',    color: '#f59e0b' },
}

function showNotif(type, rec) {
  const n = NOTIF[type]
  if (!n) return
  const sub = rec?.pickup_address
    ? rec.pickup_address.slice(0, 38)
    : `Booking #${String(rec?.id || '').slice(0, 8)}`

  // react-hot-toast with custom inline style — no external UI dep
  toast(
    `${n.icon}  ${n.title}\n${sub}`,
    {
      duration: 7000,
      position: 'top-left',
      style: {
        background:  '#10101e',
        color:       '#f0eefc',
        border:      `1px solid ${n.color}44`,
        borderLeft:  `3px solid ${n.color}`,
        fontFamily:  "'Nunito', sans-serif",
        fontSize:    '.87rem',
        fontWeight:  600,
        borderRadius:'10px',
        whiteSpace:  'pre-line',
        lineHeight:  1.45,
        boxShadow:   '0 8px 32px rgba(0,0,0,.65)',
        minWidth:    '240px',
        maxWidth:    '340px',
      },
    }
  )
}

export function useAdminNotifications(enabled = true) {
  const seenRef = useRef(new Set())   // dedupe rapid duplicate UPDATE events

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel('admin-booking-notifications')

      // New booking created
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        ({ new: rec }) => {
          showNotif('pending', rec)
        }
      )

      // Booking status changed
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        ({ new: rec, old: prev }) => {
          if (!rec?.status || rec.status === prev?.status) return

          const key = `${rec.id}:${rec.status}`
          if (seenRef.current.has(key)) return
          seenRef.current.add(key)
          // Evict old keys to avoid unbounded growth
          if (seenRef.current.size > 200) seenRef.current.clear()

          const statusMap = {
            driver_assigned: 'driver_assigned',
            cancelled:       'cancelled',
            completed:       'completed',
            payment_failed:  'payment_failed',
          }
          const type = statusMap[rec.status]
          if (type) showNotif(type, rec)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [enabled])
}