import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBar() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online',on); window.removeEventListener('offline',off) }
  }, [])
  if (!offline) return null
  return (
    <div className="offline-bar">
      <WifiOff size={15}/> You're offline — some features may not work
    </div>
  )
}
