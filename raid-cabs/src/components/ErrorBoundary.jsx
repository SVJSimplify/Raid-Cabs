import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1.5rem', padding:'2rem', textAlign:'center' }}>
        <div style={{ fontSize:'4rem' }}>🚨</div>
        <h2 style={{ fontFamily:'var(--fd)', fontSize:'1.8rem', fontWeight:700 }}>Something went wrong</h2>
        <p style={{ color:'var(--ts)', maxWidth:400, lineHeight:1.65 }}>
          An unexpected error occurred. Please refresh the page or go back to the dashboard.
        </p>
        <pre style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--rs)', padding:'1rem', fontSize:'.75rem', color:'var(--red)', maxWidth:500, overflow:'auto', textAlign:'left', maxHeight:120 }}>
          {this.state.error?.message}
        </pre>
        <div style={{ display:'flex', gap:'1rem' }}>
          <button className="btn btn-outline" onClick={() => this.setState({ hasError:false, error:null })}>Try Again</button>
          <button className="btn btn-primary" onClick={() => window.location.href='/dashboard'}>Go to Dashboard</button>
        </div>
      </div>
    )
  }
}
