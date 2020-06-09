const dgram = require('dgram')
const { PubSub } = require('@google-cloud/pubsub')

// GCP specific vars
const TOPIC = 'test-topic'
const PROJECT = 'neo4j-se-team-201905'
const KEY = '../secrets/neo4j-se-team-201905-208a5b2ddcc7.json'
const CYPHER = `CREATE (d:Dave {isCool:true})`

// Groom specific vars
const WINDOW_SIZE = 33
const WINDOW_MS = 5000

const client = new PubSub({
  projectId: PROJECT,
  keyFilename: KEY,
})
const publisher = client.topic(TOPIC)

function log(msg) {
  const ts = (new Date()).toISOString()
  console.log(`[${ts}] ${msg}`)
}

function createUdpServer(messageHandler) {
  const server = dgram.createSocket('udp4')

  // Stateful stuff
  let queue = []
  let timerId = false

  const resetTimer = () => {
    if (timerId) {
      clearInterval(timerId)
    }
    timerId = setInterval(async () => {
      flush()
    }, WINDOW_MS)
  }

  const flushCallback = (err, messageId) => {
    if (err) {
      console.error(err)
    } else {
      log(`successfully flushed new message ${messageId}`)
    }
  }

  const flush = () => {
    if (queue.length === 0) {
      log(`queue is empty, not flushing`)
    } else {
      log(`flushing ${queue.length} events...`)
      let data = Buffer.from(JSON.stringify({ batch: queue, cypher: CYPHER}))
      messageHandler(data, flushCallback)
      queue = []
    }
    resetTimer()
  }

  // Locally queue and/or flush messages out via the message handler
  const handleUdpMessage = (data) => {
    queue.push(JSON.parse(data))
    if (queue.length >= WINDOW_SIZE) {
      flush()
    }
  }

  // Primary message handler
  server.on('message', (data) => {
    try {
      handleUdpMessage(data)
    } catch (e) {
      log(`ERROR: failed to process UDP message ('${e.message}')`)
      console.error(e)
    }
  })

  //////////////////////////////
  //// Server lifecycle events

  server.on('listening', () => {
    const addr = server.address()
    log(`server listening on ${addr.address}:${addr.port}`)
    resetTimer()
  })

  server.on('close', () => {
    log(`closing server`)
    clearInterval(timerId)
  })

  server.on('error', (err) => {
    console.error(err)
    server.close()
  })

  return server
}

function publish(data, callback) {
  return publisher.publishMessage({ data }, callback)
}

/*
function dummyPub(data, callback) {
  if (callback) {
    callback(false, 1337)
  }
  return data
}
*/

createUdpServer(publish).bind(10666)
