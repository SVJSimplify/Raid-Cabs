// In-app chat between passenger and driver during active booking
import { useState, useEffect, useRef } from 'react'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Send, MessageSquare, X, ChevronDown } from 'lucide-react'

export default function ChatWidget({ bookingId, open, onClose }) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text,     setText]     = useState('')
  const [sending,  setSending]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!bookingId || !open) return
    // Load existing messages
    q(() => supabase.from('messages').select('*').eq('booking_id', bookingId).order('created_at'))
      .then(({ data }) => setMessages(data || []))

    // Real-time subscription
    const ch = supabase.channel(`chat-${bookingId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `booking_id=eq.${bookingId}`,
      }, ({ new: msg }) => {
        setMessages(prev => [...prev, msg])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [bookingId, open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async e => {
    e.preventDefault()
    if (!text.trim() || !bookingId) return
    setSending(true)
    await q(() => supabase.from('messages').insert({
      booking_id:  bookingId,
      sender_id:   user?.id,
      sender_type: 'user',
      body:        text.trim(),
    }))
    setText('')
    setSending(false)
  }

  if (!open) return null

  return (
    <div style={{
      position:'fixed', bottom:80, right:16, width:320, maxHeight:460,
      background:'var(--card2)', border:'1px solid var(--b1)',
      borderRadius:18, boxShadow:'0 20px 60px rgba(0,0,0,.7)',
      display:'flex', flexDirection:'column', zIndex:800,
      animation:'scaleIn .2s var(--ease)',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.9rem 1.1rem', borderBottom:'1px solid var(--b1)', background:'var(--card)', borderRadius:'18px 18px 0 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
          <MessageSquare size={16} style={{ color:'var(--gold)' }}/>
          <div>
            <div style={{ fontWeight:700, fontSize:'.88rem' }}>Driver Chat</div>
            <div style={{ fontSize:'.71rem', color:'var(--ts)', marginTop:1 }}>Message your driver</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:4 }}>
          <X size={16}/>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'.85rem', display:'flex', flexDirection:'column', gap:'.55rem', minHeight:200, maxHeight:320 }}>
        {messages.length === 0 && (
          <div style={{ textAlign:'center', color:'var(--tm)', fontSize:'.82rem', padding:'2rem .5rem' }}>
            <MessageSquare size={28} style={{ marginBottom:'.5rem', opacity:.4 }}/>
            <p>Say hello to your driver!</p>
            <p style={{ fontSize:'.75rem', marginTop:'.25rem', opacity:.7 }}>Messages like "I'm at gate 2" help drivers find you faster.</p>
          </div>
        )}

        {messages.map(m => {
          const isMe = m.sender_type === 'user'
          return (
            <div key={m.id} style={{ display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth:'78%',
                background: isMe ? 'linear-gradient(135deg,var(--gold),var(--orange))' : 'var(--card3)',
                color: isMe ? '#0a0a0f' : 'var(--tp)',
                borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding:'.55rem .85rem',
                fontSize:'.85rem',
                lineHeight:1.5,
                fontWeight: isMe ? 600 : 400,
              }}>
                {m.body}
                <div style={{ fontSize:'.65rem', opacity:.65, marginTop:'.2rem', textAlign:'right' }}>
                  {new Date(m.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <form onSubmit={send} style={{ display:'flex', gap:'.5rem', padding:'.75rem', borderTop:'1px solid var(--b1)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          style={{ flex:1, background:'rgba(255,255,255,.05)', border:'1px solid var(--b1)', borderRadius:10, padding:'.55rem .85rem', color:'var(--tp)', fontFamily:'var(--fb)', fontSize:'.86rem', outline:'none' }}
          onFocus={e => e.target.style.borderColor='rgba(245,166,35,.4)'}
          onBlur={e => e.target.style.borderColor='var(--b1)'}
          autoComplete="off"
        />
        <button type="submit" disabled={!text.trim() || sending}
          style={{ width:36, height:36, background:'linear-gradient(135deg,var(--gold),var(--orange))', border:'none', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity: !text.trim()?0.4:1, transition:'opacity .2s' }}>
          <Send size={14} color="#0a0a0f"/>
        </button>
      </form>
    </div>
  )
}
