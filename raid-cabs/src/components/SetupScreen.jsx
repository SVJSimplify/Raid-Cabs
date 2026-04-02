export default function SetupScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: '#05050e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif", padding: '2rem',
    }}>
      <div style={{ maxWidth: 540, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚙️</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 800, color: '#ffb347', marginBottom: '.75rem' }}>
            Supabase Not Connected
          </h1>
          <p style={{ color: '#9890c2', lineHeight: 1.7, fontSize: '.95rem' }}>
            The app can't connect because <code style={{ background: 'rgba(255,179,71,.1)', color: '#ffb347', padding: '2px 7px', borderRadius: 5 }}>.env</code> is missing or has placeholder values.
          </p>
        </div>

        <div style={{ background: '#10101e', border: '1px solid rgba(255,165,40,.15)', borderRadius: 16, padding: '2rem', marginBottom: '1.5rem' }}>
          <p style={{ color: '#9890c2', fontSize: '.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1rem' }}>
            Fix in 3 steps
          </p>
          {[
            ['1', 'Create .env file', 'In your raid-cabs folder (same level as package.json)'],
            ['2', 'Add your keys', 'Copy from Supabase → Settings → API'],
            ['3', 'Restart dev server', 'Stop and run npm run dev again'],
          ].map(([n, title, desc]) => (
            <div key={n} style={{ display: 'flex', gap: '1rem', marginBottom: '1.1rem', alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,179,71,.15)', border: '1px solid rgba(255,179,71,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffb347', fontWeight: 800, fontSize: '.82rem', flexShrink: 0, marginTop: 2 }}>{n}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#ede8d8', fontSize: '.9rem' }}>{title}</div>
                <div style={{ color: '#9890c2', fontSize: '.82rem', marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#0c0c1c', border: '1px solid rgba(255,165,40,.12)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <p style={{ color: '#504c74', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.75rem' }}>
            .env contents
          </p>
          <pre style={{ color: '#ede8d8', fontSize: '.82rem', lineHeight: 1.8, margin: 0, fontFamily: 'monospace', overflowX: 'auto' }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_UPI_ID=yourname@upi`}
          </pre>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '.72rem 1.4rem', background: 'linear-gradient(135deg,#ffb347,#ff6b35)', color: '#05050e', borderRadius: 10, fontWeight: 700, fontSize: '.88rem', textDecoration: 'none' }}>
            Open Supabase →
          </a>
        </div>

        <p style={{ textAlign: 'center', color: '#504c74', fontSize: '.78rem', marginTop: '1.5rem' }}>
          After editing .env, restart the dev server with <code style={{ color: '#9890c2' }}>npm run dev</code>
        </p>
      </div>
    </div>
  )
}
