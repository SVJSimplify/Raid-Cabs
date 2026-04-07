// Empty shim for the 'ws' Node.js package
// Supabase realtime-js imports 'ws' but the browser has native WebSocket
// This shim prevents a broken worker chunk from being bundled
export default class WebSocketShim extends WebSocket {}
