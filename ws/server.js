/* global process */
const fs = require('fs')
const http = require('http')
const https = require('https')

const WebSocket = require('ws')
const { PubSub } = require('@google-cloud/pubsub')
const cypher = require('../cypher')

// GCP specific vars
const TOPIC = process.env.GROOM_TOPIC || 'groom'
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT
const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS

// Groom specific vars
const MAX_BATCH_SIZE = parseInt(process.env.GROOM_MAX_BATCH_SIZE || '1000')
const FLUSH_INTERVAL_MS = parseInt(process.env.GROOM_FLUSH_INTERVAL_MS || '5000')

// http server details (no key passwords yet)
const HOST = process.env.HOST || 'localhost'
const PORT = parseInt(process.env.PORT || '8000')
const SSL_CERT = process.env.SSL_CERT || false
const SSL_KEY = process.env.SSL_KEY || false

// Running in GCE/GAE, authentication is pulled from the aether
const client = new PubSub({
  ...(PROJECT ? { projectId: PROJECT } : {}),
  ...(KEY ? { keyFilename: KEY } : {}),
})
const publisher = client.topic(TOPIC)

// Compose our WebSocket server with its built in queue and flush timers
// xxx: we use a "noServer" approach as our http server handles initial
// connection waiting for an Upgrade request
function createWsServer(messageHandler) {
  const server = new WebSocket.Server({ noServer: true })
// Stateful stuff...our queue and a reference to our flush timer
  let queue = []
  let timerId = false

  const resetTimer = () => {
    if (timerId) {
      clearInterval(timerId)
    }
    timerId = setInterval(async () => {
      flush()
    }, FLUSH_INTERVAL_MS)
  }

  const flushCallback = (err, messageId) => {
    if (err) {
      console.error(err)
    } else {
      console.log(`successfully flushed new PubSub message ${messageId}`)
    }
  }

  const flush = () => {
    if (queue.length === 0) {
      if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
        console.debug(`queue is empty, not flushing`)
      }
    } else {
      console.log(`flushing ${queue.length} events...`)
      let data = Buffer.from(
        JSON.stringify({ batch: queue, cypher: cypher.insertEvents})
      )
      messageHandler(data, flushCallback)
      queue = []
    }
    resetTimer()
  }

  // Main WebSocket handler logic for each connection post-handshake
  server.on('connection', (ws) => {
    resetTimer()

    // All messages first get queued and flushed later
    ws.on('message', (message) => {
      try {
	queue.push(JSON.parse(message.toString().trim()))
	if (queue.length >= MAX_BATCH_SIZE) {
          flush()
	}
      } catch (e) {
	console.log(`ERROR: failed to process websocket message ('${e.message}')`)
	console.error(e)
      }
    })
  })

  server.on('close', () => {
    clearInterval(timerId)
    flush()
  })

  server.on('error', (err) => {
    console.error(err)
    server.close()
  })

  return server
}

// Create an http or https server
const httpServer = (SSL_CERT !== false && SSL_KEY !== false)
    ? https.createServer({
      cert: fs.readFileSync(SSL_CERT),
      key: fs.readFileSync(SSL_KEY),
    })
    : http.createServer()

// Setup and run our server, giving it the PubSub publisher to use
const wsServer = createWsServer((data, callback) => {
  return publisher.publishMessage({ data }, callback)
}, httpServer)

// Provide liveness/readiness checks separate from WS connections
httpServer.on('upgrade', (req, socket, head) => {
  console.log(`got upgrade request from ${socket.remoteAddress}:${socket.remotePort}`)
  wsServer.handleUpgrade(req, socket, head, (ws) => {
    wsServer.emit('connection', ws, req)
  })
})

// Let the logs know when we're actually listening
httpServer.on('listening', () => {
  const addr = httpServer.address()
  console.log(`http server listening on ${addr.address}:${addr.port}`)
})

// We provide some manual http routing to some health checks for GAE
httpServer.on('request', (req, res) => {
  if (req.url === '/liveness_check' || req.url === '/readiness_check') {
    res.statusCode = 200
    res.end('200 OK\n')
  } else {
    res.statusCode = 404
    res.end('404: not found\n')
  }
  console.log(req.path)
})

// Make sure we don't die with some data in the queue
const safeShutdown = () => {
  console.log(`shutting down server and exiting...`)
  wsServer.close(() => {
    httpServer.close(() => process.exit(0))
  })
}
process.on('SIGINT', safeShutdown)
process.on('SIGTERM', safeShutdown)

// Bind and run!
httpServer.listen({ host: HOST, port: PORT })
