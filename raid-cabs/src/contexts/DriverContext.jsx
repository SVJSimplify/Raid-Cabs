import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, q } from '../lib/supabase'

const DriverCtx = createContext(null)

export function DriverProvider({ children }) {
  const [driver,         setDriver]         = useState(null)
  const [currentBooking, setCurrentBooking] = useState(null)
  const [loading,        setLoading]        = useState(true)

  const loadFromSession = useCallback(async () => {
    const saved = sessionStorage.getItem('driver_session')
    if (!saved) { setLoading(false); return }

    try {
      const cached = JSON.parse(saved)
      if (!cached?.id) { setLoading(false); return }

      // Re-fetch latest driver data from DB
      const { data, error } = await q(() =>
        supabase.from('drivers').select('*').eq('id', cached.id).maybeSingle()
      )
      if (error || !data) {
        sessionStorage.removeItem('driver_session')
        setLoading(false)
        return
      }
      sessionStorage.setItem('driver_session', JSON.stringify(data))
      setDriver(data)
      await fetchCurrentBooking(data.id)
    } catch {
      sessionStorage.removeItem('driver_session')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadFromSession() }, [loadFromSession])

  const fetchCurrentBooking = async driverId => {
    const { data } = await q(() =>
      supabase.from('bookings')
        .select('*')
        .eq('driver_id', driverId)
        .in('status', ['confirmed','en_route','in_progress'])  // confirmed=approved, en_route=going to pickup, in_progress=riding
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    setCurrentBooking(data || null)
  }

  // Real-time booking updates
  useEffect(() => {
    if (!driver) return
    const ch = supabase.channel(`driver-bk-${driver.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `driver_id=eq.${driver.id}`,
      }, () => fetchCurrentBooking(driver.id))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [driver])

  const updateBookingStatus = async (bookingId, status) => {
    const extra = {}
    if (status === 'en_route')    extra.dispatched_at = new Date().toISOString()
    if (status === 'in_progress') extra.started_at    = new Date().toISOString()
    if (status === 'completed')   extra.completed_at = new Date().toISOString()
    if (status === 'cancelled')   extra.cancelled_at = new Date().toISOString()

    const { error } = await q(() =>
      supabase.from('bookings').update({ status, ...extra }).eq('id', bookingId)
    )
    if (!error) {
      await fetchCurrentBooking(driver.id)
      if (status === 'completed' || status === 'cancelled') {
        await q(() => supabase.from('drivers').update({ status:'available' }).eq('id', driver.id))
        setDriver(d => ({ ...d, status:'available' }))
        sessionStorage.setItem('driver_session', JSON.stringify({ ...driver, status:'available' }))
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
    const updated = { ...driver, status: online ? 'available' : 'offline', is_online: online }
    setDriver(updated)
    sessionStorage.setItem('driver_session', JSON.stringify(updated))
  }

  const signOutDriver = () => {
    sessionStorage.removeItem('driver_session')
    setDriver(null)
    setCurrentBooking(null)
  }

  return (
    <DriverCtx.Provider value={{
      driver, currentBooking, loading,
      isDriver: !!driver,
      fetchDriver: loadFromSession,
      fetchCurrentBooking,
      updateBookingStatus,
      setOnlineStatus,
      signOutDriver,
    }}>
      {children}
    </DriverCtx.Provider>
  )
}

export const useDriver = () => useContext(DriverCtx)
