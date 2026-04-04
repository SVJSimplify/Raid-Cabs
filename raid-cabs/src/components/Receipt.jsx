import { X, Printer, Share2 } from 'lucide-react'

export default function Receipt({ booking, driver, onClose }) {
  if (!booking) return null

  const share = async () => {
    const text = `🚖 Raid Cabs Receipt\nReceipt: ${booking.receipt_number}\nFrom: ${booking.pickup_address}\nTo: ${booking.drop_address}\nDistance: ${booking.distance_km}km\nFare: ₹${booking.final_fare}\nDate: ${new Date(booking.created_at).toLocaleString('en-IN')}\n\nOur Wheels Take You to Fly ✈️`
    if (navigator.share) {
      await navigator.share({ title:'Raid Cabs Receipt', text })
    } else {
      await navigator.clipboard.writeText(text)
      alert('Receipt copied to clipboard!')
    }
  }

  const rows = [
    ['Receipt No.', booking.receipt_number || '—'],
    ['Date', new Date(booking.created_at).toLocaleString('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})],
    ['Pickup', booking.pickup_address],
    ['Drop', booking.drop_address],
    ['Distance', `${booking.distance_km} km`],
    ['Base Fare', `₹${booking.base_fare}`],
    booking.discount_amount > 0 && ['Concession Discount', `−₹${booking.discount_amount}`],
  ].filter(Boolean)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box receipt-print" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'1.75rem', paddingBottom:'1.25rem', borderBottom:'1px dashed var(--border2)' }}>
          <img src="/logo.png" alt="Raid Cabs" style={{ width:60, marginBottom:'.75rem', filter:'drop-shadow(0 0 8px rgba(255,179,71,.4))' }} onError={e=>e.target.style.display='none'}/>
          <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:700, color:'var(--gold)' }}>Raid Cabs</div>
          <div style={{ fontSize:'.8rem', color:'var(--ts)', marginTop:2 }}>Our Wheels Take You to Fly</div>
          <div className="badge b-green mt2">✓ Trip Receipt</div>
        </div>

        {/* Rows */}
        {rows.map(([l,v]) => (
          <div key={l} className="fare-r">
            <span style={{ color:'var(--tm)' }}>{l}</span>
            <span style={{ fontWeight:600, textAlign:'right', maxWidth:'60%', color: l.includes('Discount')?'var(--green)':'var(--tp)' }}>{v}</span>
          </div>
        ))}

        {/* Total */}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'1rem 0 .5rem', borderTop:'2px solid var(--border2)', marginTop:'.5rem' }}>
          <span style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', fontWeight:700 }}>Total Paid</span>
          <span style={{ fontFamily:'var(--fd)', fontSize:'1.6rem', fontWeight:900, color:'var(--gold)' }}>₹{booking.final_fare}</span>
        </div>

        {/* Driver */}
        {driver && (
          <div style={{ background:'rgba(255,255,255,.03)', borderRadius:'var(--rs)', padding:'.9rem', marginTop:'1rem', border:'1px solid var(--border)' }}>
            <div style={{ fontSize:'.72rem', color:'var(--tm)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'.45rem' }}>Driver</div>
            <div style={{ fontWeight:700 }}>{driver.name}</div>
            <div style={{ fontSize:'.8rem', color:'var(--ts)', marginTop:2 }}>{driver.vehicle_model} · {driver.vehicle_number}</div>
            {booking.user_rating && (
              <div style={{ fontSize:'.8rem', color:'var(--gold)', marginTop:4 }}>
                {'★'.repeat(booking.user_rating)}{'☆'.repeat(5-booking.user_rating)} Your rating
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:'center', marginTop:'1.5rem', paddingTop:'1rem', borderTop:'1px dashed var(--border)', fontSize:'.75rem', color:'var(--tm)' }}>
          Thank you for riding with Raid Cabs!<br/>raidcabs.com · support@raidcabs.com
        </div>

        <div style={{ display:'flex', gap:'.75rem', marginTop:'1.5rem' }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => window.print()}><Printer size={13}/> Print</button>
          <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={share}><Share2 size={13}/> Share</button>
          <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={onClose}><X size={13}/> Close</button>
        </div>
      </div>
    </div>
  )
}
