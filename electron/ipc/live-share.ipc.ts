import { ipcMain, BrowserWindow } from 'electron'
import * as http from 'http'
import * as dgram from 'dgram'
import * as os from 'os'
import * as crypto from 'crypto'

const DISCOVERY_PORT = 47891

interface HostSession {
  server: http.Server
  udpTimer: NodeJS.Timeout | null
  udpSocket: dgram.Socket | null
  pairId: string
  ip: string
  port: number
  pin: string
  docName: string
  updatedAt: number
  version: number
  pdfBuffer: Buffer
  clients: Map<string, http.ServerResponse>
}

interface ClientSession {
  pairId: string
  ip: string
  port: number
  pin: string
  docName: string
  eventReq: http.ClientRequest | null
}

let hostSession: HostSession | null = null
let clientSession: ClientSession | null = null
let discoverySocket: dgram.Socket | null = null
const discoveredHosts = new Map<
  string,
  { pairId: string; hostName: string; docName: string; ip: string; port: number; lastSeen: number }
>()

function getLocalLanIp(): string {
  const nets = os.networkInterfaces()
  const candidates: string[] = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
          candidates.unshift(net.address)
        } else {
          candidates.push(net.address)
        }
      }
    }
  }
  return candidates[0] || '127.0.0.1'
}

function encodePairId(ip: string, port: number, pin: string): string {
  const octets = ip.split('.').map((n) => parseInt(n, 10))
  const ipHex = octets.map((b) => (isNaN(b) ? 0 : b).toString(16).padStart(2, '0')).join('').toUpperCase()
  const port36 = port.toString(36).toUpperCase()
  return `VLD-${ipHex}-${port36}-${pin}`
}

function decodePairId(raw: string): { ip: string; port: number; pin: string } | null {
  const clean = raw.trim().toUpperCase()
  const match = clean.match(/^VLD-([0-9A-F]{8})-([0-9A-Z]+)-(\d{4})$/)
  if (!match) return null
  const ipHex = match[1]
  const octets = [
    parseInt(ipHex.slice(0, 2), 16),
    parseInt(ipHex.slice(2, 4), 16),
    parseInt(ipHex.slice(4, 6), 16),
    parseInt(ipHex.slice(6, 8), 16),
  ]
  const port = parseInt(match[2], 36)
  const pin = match[3]
  if (octets.some(isNaN) || isNaN(port) || port <= 0 || port > 65535) return null
  return { ip: octets.join('.'), port, pin }
}

function httpGetJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (err) {
          reject(err)
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error('Koneksi timeout — pastikan satu Wi-Fi/LAN dan Windows Firewall mengizinkan akses'))
    })
  })
}

function httpGetBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error('Unduh PDF timeout'))
    })
  })
}

export function registerLiveShareIpc(getWindow: () => BrowserWindow | null) {
  const sendToRenderer = (channel: string, payload: any) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }

  const getHostStatus = () => {
    if (!hostSession) {
      return {
        isHosting: false,
        pairId: null,
        ip: null,
        port: null,
        pin: null,
        docName: null,
        clientCount: 0,
        version: 0,
      }
    }
    return {
      isHosting: true,
      pairId: hostSession.pairId,
      ip: hostSession.ip,
      port: hostSession.port,
      pin: hostSession.pin,
      docName: hostSession.docName,
      clientCount: hostSession.clients.size,
      version: hostSession.version,
    }
  }

  const stopHost = () => {
    if (!hostSession) return
    const session = hostSession
    hostSession = null
    if (session.udpTimer) clearInterval(session.udpTimer)
    try {
      session.udpSocket?.close()
    } catch {}
    for (const res of session.clients.values()) {
      try {
        res.write(`event: session-closed\ndata: {}\n\n`)
        res.end()
      } catch {}
    }
    session.clients.clear()
    try {
      session.server.close()
    } catch {}
    sendToRenderer('live-share:host-status', getHostStatus())
  }

  const stopClient = () => {
    if (!clientSession) return
    try {
      clientSession.eventReq?.destroy()
    } catch {}
    clientSession = null
    sendToRenderer('live-share:client-status', { isJoined: false })
  }

  // Start Host Live Sharing Server
  ipcMain.handle('live-share:start-host', async (_e, payload: { pdfBytes: Uint8Array; docName: string }) => {
    stopHost()
    const pin = String(crypto.randomInt(1000, 9999))
    const ip = getLocalLanIp()
    const pdfBuffer = Buffer.from(payload.pdfBytes)
    const docName = payload.docName || 'document.pdf'

    return await new Promise((resolve, reject) => {
      const clients = new Map<string, http.ServerResponse>()
      const server = http.createServer((req, res) => {
        const reqUrl = new URL(req.url || '/', 'http://localhost')
        const reqPin = reqUrl.searchParams.get('pin')
        if (reqPin !== pin) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'PIN / Pair ID tidak valid' }))
          return
        }

        if (reqUrl.pathname === '/info') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              docName: hostSession?.docName || docName,
              version: hostSession?.version || 1,
              updatedAt: hostSession?.updatedAt || Date.now(),
            })
          )
          return
        }

        if (reqUrl.pathname === '/pdf') {
          const buf = hostSession?.pdfBuffer || pdfBuffer
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Length': buf.byteLength,
            'Cache-Control': 'no-store',
          })
          res.end(buf)
          return
        }

        if (reqUrl.pathname === '/events') {
          const clientId = `${req.socket.remoteAddress || 'peer'}:${Date.now()}:${Math.random()}`
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          })
          res.write(`event: connected\ndata: ${JSON.stringify({ version: hostSession?.version || 1 })}\n\n`)
          clients.set(clientId, res)
          sendToRenderer('live-share:host-status', getHostStatus())

          req.on('close', () => {
            clients.delete(clientId)
            sendToRenderer('live-share:host-status', getHostStatus())
          })
          return
        }

        res.writeHead(404)
        res.end('Not found')
      })

      server.on('error', (err) => {
        reject(err)
      })

      server.listen(0, '0.0.0.0', () => {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 47890
        const pairId = encodePairId(ip, port, pin)

        let udpSocket: dgram.Socket | null = null
        let udpTimer: NodeJS.Timeout | null = null
        try {
          udpSocket = dgram.createSocket('udp4')
          udpSocket.bind(() => {
            try {
              udpSocket?.setBroadcast(true)
            } catch {}
          })
          const broadcastPayload = JSON.stringify({
            app: 'veldora-live-review',
            pairId,
            hostName: os.hostname(),
            docName,
            ip,
            port,
          })
          const sendBeacon = () => {
            if (!hostSession || !udpSocket) return
            const msg = Buffer.from(broadcastPayload)
            udpSocket.send(msg, 0, msg.length, DISCOVERY_PORT, '255.255.255.255', () => {})
          }
          udpTimer = setInterval(sendBeacon, 2000)
          setTimeout(sendBeacon, 150)
        } catch {}

        hostSession = {
          server,
          udpTimer,
          udpSocket,
          pairId,
          ip,
          port,
          pin,
          docName,
          updatedAt: Date.now(),
          version: 1,
          pdfBuffer,
          clients,
        }

        const status = getHostStatus()
        sendToRenderer('live-share:host-status', status)
        resolve(status)
      })
    })
  })

  ipcMain.handle('live-share:update-pdf', async (_e, payload: { pdfBytes: Uint8Array; docName?: string }) => {
    if (!hostSession) return { ok: false }
    hostSession.pdfBuffer = Buffer.from(payload.pdfBytes)
    if (payload.docName) hostSession.docName = payload.docName
    hostSession.version += 1
    hostSession.updatedAt = Date.now()
    const eventData = JSON.stringify({
      version: hostSession.version,
      updatedAt: hostSession.updatedAt,
      docName: hostSession.docName,
    })
    for (const res of hostSession.clients.values()) {
      try {
        res.write(`event: pdf-updated\ndata: ${eventData}\n\n`)
      } catch {}
    }
    sendToRenderer('live-share:host-status', getHostStatus())
    return { ok: true, version: hostSession.version }
  })

  ipcMain.handle('live-share:stop-host', async () => {
    stopHost()
    return { ok: true }
  })

  ipcMain.handle('live-share:get-host-status', async () => {
    return getHostStatus()
  })

  // Discover active LAN sessions on port 47891
  ipcMain.handle('live-share:start-discovery', async () => {
    if (!discoverySocket) {
      try {
        discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
        discoverySocket.on('message', (msg) => {
          try {
            const parsed = JSON.parse(msg.toString('utf8'))
            if (parsed?.app === 'veldora-live-review' && parsed?.pairId) {
              discoveredHosts.set(parsed.pairId, {
                pairId: parsed.pairId,
                hostName: parsed.hostName || parsed.ip,
                docName: parsed.docName || 'document.pdf',
                ip: parsed.ip,
                port: parsed.port,
                lastSeen: Date.now(),
              })
              const now = Date.now()
              const activeList = Array.from(discoveredHosts.values()).filter(
                (h) => now - h.lastSeen < 8000
              )
              sendToRenderer('live-share:discovered', activeList)
            }
          } catch {}
        })
        discoverySocket.bind(DISCOVERY_PORT)
      } catch {}
    }
    const now = Date.now()
    return Array.from(discoveredHosts.values()).filter((h) => now - h.lastSeen < 8000)
  })

  ipcMain.handle('live-share:stop-discovery', async () => {
    if (discoverySocket) {
      try {
        discoverySocket.close()
      } catch {}
      discoverySocket = null
    }
    discoveredHosts.clear()
    return { ok: true }
  })

  // Join a host session by Pair ID
  ipcMain.handle('live-share:join', async (_e, pairIdInput: string) => {
    const decoded = decodePairId(pairIdInput)
    if (!decoded) {
      throw new Error('Format Pair ID tidak valid. Contoh: VLD-C0A8010A-1234-5678')
    }

    stopClient()

    const baseUrl = `http://${decoded.ip}:${decoded.port}`
    const info = await httpGetJson(`${baseUrl}/info?pin=${decoded.pin}`)
    const pdfBuf = await httpGetBuffer(`${baseUrl}/pdf?pin=${decoded.pin}`)

    const eventReq = http.get(`${baseUrl}/events?pin=${decoded.pin}`, (res) => {
      let buffer = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        buffer += chunk
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const block of parts) {
          if (block.includes('event: pdf-updated')) {
            httpGetBuffer(`${baseUrl}/pdf?pin=${decoded.pin}`)
              .then((newBuf) => {
                sendToRenderer('live-share:pdf-received', {
                  pdfBytes: new Uint8Array(newBuf),
                  docName: info.docName,
                })
              })
              .catch(() => {})
          } else if (block.includes('event: session-closed')) {
            stopClient()
          }
        }
      })
      res.on('end', () => {
        stopClient()
      })
    })
    eventReq.on('error', () => {
      stopClient()
    })

    clientSession = {
      pairId: pairIdInput.trim().toUpperCase(),
      ip: decoded.ip,
      port: decoded.port,
      pin: decoded.pin,
      docName: info.docName || 'Live Review.pdf',
      eventReq,
    }

    sendToRenderer('live-share:client-status', {
      isJoined: true,
      pairId: clientSession.pairId,
      docName: clientSession.docName,
    })

    return {
      docName: clientSession.docName,
      pdfBytes: new Uint8Array(pdfBuf),
    }
  })

  ipcMain.handle('live-share:leave', async () => {
    stopClient()
    return { ok: true }
  })
}
