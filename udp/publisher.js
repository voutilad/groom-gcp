/* global process */
const dgram = require('dgram')
const { PubSub } = require('@google-cloud/pubsub')
const cypher = require('../cypher')

// GCP specific vars
const TOPIC = process.env.GROOM_TOPIC || 'groom'
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT
const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS

// Groom specific vars
const MAX_BATCH_SIZE = process.env.GROOM_MAX_BATCH_SIZE || 1000
const FLUSH_INTERVAL_MS = process.env.GROOM_FLUSH_INTERVAL_MS || 5000

// Running in GCE/GAE, authentication is pulled from the aether
const client = new PubSub({
  ...(PROJECT ? { projectId: PROJECT } : {}),
  ...(KEY ? { keyFilename: KEY } : {}),
})
const publisher = client.topic(TOPIC)

// Compose our UDP server with its built in queue and flush timers
function createUdpServer(messageHandler) {
  const server = dgram.createSocket('udp4')

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
      console.log(`successfully flushed new message ${messageId}`)
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

  // All messages first get queued and flushed later
  server.on('message', (data) => {
    try {
      queue.push(JSON.parse(data))
      if (queue.length >= MAX_BATCH_SIZE) {
        flush()
      }
    } catch (e) {
      console.log(`ERROR: failed to process UDP message ('${e.message}')`)
      console.error(e)
    }
  })

  //////////////////////////////
  //// Server lifecycle events

  server.on('listening', () => {
    const addr = server.address()
    console.log(`server listening on ${addr.address}:${addr.port}`)
    resetTimer()
  })

  server.on('close', () => {
    console.log(`closing server...`)
    clearInterval(timerId)
    flush()
  })

  server.on('error', (err) => {
    console.error(err)
    server.close()
  })

  return server
}

// Setup and run our server, giving it the PubSub publisher to use
const server = createUdpServer((data, callback) => {
  return publisher.publishMessage({ data }, callback)
})


// Make sure we don't die with some data in the queue
const safeShutdown = () => {
  server.close(() => process.exit(0))
}
process.on('SIGINT', safeShutdown)
process.on('SIGTERM', safeShutdown)

// Bind and run!
server.bind(10666)
