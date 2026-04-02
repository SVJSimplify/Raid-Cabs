import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, q } from '../lib/supabase'
import { useAuth } from './AuthContext'

const DriverCtx = createContext(null)

// Normalise phone to last 10 digits for comparison
const last10 = p => (p || '').replace(/\D/g, '').slice(-10)

export function DriverProvider({ children }) {
  const { user } = useAuth()
  const [driver,         setDriver]         = useState(null)
  const [currentBooking, setCurrentBooking] = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [linkError,      setLinkError]      = useState(null)

  const fetchDriver = useCallback(async () => {
    if (!user) { setLoading(false); return }

    // 1. Try by auth_user_id first (already linked)
    let { data } = await q(() =>
      supabase.from('drivers')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('is_approved', true)
        .maybeSingle()
    )

    // 2. If not linked yet, try matching by phone number
    if (!data) {
      const authPhone = user.phone || ''
      if (authPhone) {
        const { data: allDrivers } = await q(() =>
          supabase.from('drivers').select('*').eq('is_approved', true)
        )
        const match = (allDrivers || []).find(
          d => last10(d.phone) === last10(authPhone)
        )
        if (match) {
          // Link the auth user to this driver record
          await q(() =>
            supabase.from('drivers')
              .update({ auth_user_id: user.id })
              .eq('id', match.id)
          )
          data = { ...match, auth_user_id: user.id }
        }
      }
    }

    if (!data) {
      setLinkError('no_driver')
      setLoading(false)
      return
    }

    setDriver(data)
    setLinkError(null)
    await fetchCurrentBooking(data.id)
    setLoading(false)
  }, [user])

  const fetchCurrentBooking = async driverId => {
    const { data } = await q(() =>
      supabase.from('bookings')
        .select('*')
        .eq('driver_id', driverId)
        .in('status', ['confirmed', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    setCurrentBooking(data || null)
  }

  useEffect(() => { fetchDriver() }, [fetchDriver])

  // Real-time: watch for new bookings assigned to this driver
  useEffect(() => {
    if (!driver) return
    const ch = supabase.channel(`driver-booking-${driver.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `driver_id=eq.${driver.id}`,
      }, () => fetchCurrentBooking(driver.id))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [driver])

  const updateBookingStatus = async (bookingId, status) => {
    const extra = {}
    if (status === 'in_progress') extra.started_at   = new Date().toISOString()
    if (status === 'completed')   extra.completed_at  = new Date().toISOString()
    if (status === 'cancelled')   extra.cancelled_at  = new Date().toISOString()

    const { error } = await q(() =>
      supabase.from('bookings').update({ status, ...extra }).eq('id', bookingId)
    )
    if (!error) {
      await fetchCurrentBooking(driver.id)
      if (status === 'completed' || status === 'cancelled') {
        // Mark driver available again
        await q(() => supabase.from('drivers').update({ status: 'available' }).eq('id', driver.id))
        setDriver(d => ({ ...d, status: 'available' }))
      }
    }
    return { error }
  }

  const setOnlineStatus = async online => {
    await q(() => supabase.from('drivers').update({
      status:    online ? 'available' : 'offline',
      is_online: online,
      last_seen: new Date().toISOString(),
    }).eq('id', driver.id))
    setDriver(d => ({ ...d, status: online ? 'available' : 'offline', is_online: online }))
  }

  const isDriver = !!driver

  return (
    <DriverCtx.Provider value={{
      driver, currentBooking, loading, linkError, isDriver,
      fetchDriver, fetchCurrentBooking, updateBookingStatus, setOnlineStatus,
    }}>
      {children}
    </DriverCtx.Provider>
  )
}

export const useDriver = () => useContext(DriverCtx)
