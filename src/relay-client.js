import { Crypto } from './crypto.js';

export const RelayClient = {
  connections: new Map(),

  // Connect to relay
  connect: (url) => {
    const attemptConnect = () => {
      return new Promise((resolve, reject) => {
        try {
          // Check for cached connection with stale detection
          if (RelayClient.connections.has(url)) {
            const cached = RelayClient.connections.get(url);
            if (cached.readyState === WebSocket.CLOSING || cached.readyState === WebSocket.CLOSED) {
              RelayClient.connections.delete(url);
            } else {
              resolve(cached);
              return;
            }
          }
          
          const ws = new WebSocket(url);
          
          ws.onopen = () => {
            RelayClient.connections.set(url, ws);
            resolve(ws);
          };
          
          ws.onerror = (error) => {
            reject(error);
          };
          
          ws.onclose = () => {
            RelayClient.connections.delete(url);
          };
        } catch (e) {
          reject(e);
        }
      });
    };

    // Retry with exponential backoff: 1s → 2s → 4s
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000;

    return (async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          return await attemptConnect();
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY * Math.pow(2, attempt);
            console.log(`[NAC Relay] Connection to ${url} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            throw new Error(`Failed to connect to ${url} after ${MAX_RETRIES + 1} attempts`);
          }
        }
      }
    })();
  },

  // Disconnect from relay
  disconnect: (url) => {
    const ws = RelayClient.connections.get(url);
    if (ws) {
      ws.close();
      RelayClient.connections.delete(url);
    }
  },

  // Disconnect all
  disconnectAll: () => {
    for (const ws of RelayClient.connections.values()) {
      ws.close();
    }
    RelayClient.connections.clear();
  },

  // Publish event to relays
  publish: async (event, relayUrls) => {
    const publishToRelay = async (url) => {
      const ws = await RelayClient.connect(url);
      
      // Send event
      const message = JSON.stringify(['EVENT', event]);
      ws.send(message);
      
      // Wait for OK response
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ accepted: false, message: 'Timeout waiting for relay response' }), 5000);
        
        const handler = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data[0] === 'OK' && data[1] === event.id) {
              clearTimeout(timeout);
              ws.removeEventListener('message', handler);
              resolve({ accepted: data[2], message: data[3] || '' }); // data[3] = relay reason
            } else if (data[0] === 'NOTICE') {
              console.log(`[NAC Relay] NOTICE from ${url}: ${data[1]}`);
            }
          } catch (err) {
            // Ignore parse errors
          }
        };
        
        ws.addEventListener('message', handler);
      });
      
      return { url, success: result.accepted, error: result.accepted ? null : (result.message || 'Event rejected by relay') };
    };

    // Publish to all relays in parallel
    const settled = await Promise.allSettled(
      relayUrls.map(url => publishToRelay(url).catch(e => ({ url, success: false, error: e.message })))
    );

    const results = {};
    for (const result of settled) {
      const { url, success, error } = result.value;
      results[url] = { success, error };
    }
    return results;
  },

  // Check if connected to relay
  isConnected: (url) => {
    const ws = RelayClient.connections.get(url);
    return ws && ws.readyState === WebSocket.OPEN;
  },

  // Subscribe to relay events (REQ/EOSE pattern)
  // options.onProgress(info) — optional callback for connection-level progress
  subscribe: async (filter, relayUrls, options = {}) => {
    const timeout = options.timeout || 15000;
    const idleTimeout = options.idleTimeout || 10000;
    const onProgress = options.onProgress || (() => {});
    const events = [];
    const subId = Crypto.bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
    const connectionStats = { attempted: 0, connected: 0, failed: 0, errors: [] };

    for (const url of relayUrls) {
      connectionStats.attempted++;
      onProgress({ phase: 'connecting', url, ...connectionStats });
      try {
        const ws = await RelayClient.connect(url);
        connectionStats.connected++;
        onProgress({ phase: 'connected', url, ...connectionStats });
        ws.send(JSON.stringify(['REQ', subId, filter]));

        await new Promise((resolve) => {
          let idleTimer = setTimeout(resolve, idleTimeout);
          const totalTimer = setTimeout(resolve, timeout);

          const handler = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data[0] === 'EVENT' && data[1] === subId) {
                events.push(data[2]);
                clearTimeout(idleTimer);
                idleTimer = setTimeout(resolve, idleTimeout);
              } else if (data[0] === 'EOSE' && data[1] === subId) {
                clearTimeout(idleTimer);
                clearTimeout(totalTimer);
                ws.removeEventListener('message', handler);
                resolve();
              }
            } catch (parseErr) {
              console.error('[NAC RelayClient] Parse error:', parseErr);
            }
          };
          ws.addEventListener('message', handler);
        });

        try { ws.send(JSON.stringify(['CLOSE', subId])); } catch(e) {}
      } catch (e) {
        connectionStats.failed++;
        const errMsg = e.message || 'Connection failed';
        connectionStats.errors.push({ url, error: errMsg });
        console.error('[NAC RelayClient] Subscribe error:', url, e);
        onProgress({ phase: 'relay_error', url, error: errMsg, ...connectionStats });
      }
    }
    // Attach connection stats to the returned array for caller inspection
    events._connectionStats = connectionStats;
    return events;
  }
};
