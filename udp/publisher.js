const dgram = require('dgram')
const { PubSub } = require('@google-cloud/pubsub')

// GCP specific vars
const TOPIC = 'groom'
const PROJECT = 'neo4j-se-team-201905'
const KEY = '../secrets/neo4j-se-team-201905-208a5b2ddcc7.json'
const CYPHER = `
MERGE (frame:Frame {tic: event.frame.tic})
    ON CREATE SET frame.millis = event.frame.millis
CREATE (ev:Event {type: event.type, counter: event.counter})
CREATE (ev)-[:OCCURRED_AT]->(frame)

// Conditionally process Actor and Target
FOREACH (thing IN [x IN [event.actor, event.target] WHERE x IS NOT NULL] |
    MERGE (actor:Actor {id: thing.id}) ON CREATE SET actor.type = thing.type
    MERGE (subsector:SubSector {id: thing.position.subsector})
    CREATE (actorState:State)
    SET actorState.position = point(thing.position),
        actorState.angle = thing.position.angle,
        actorState.health = thing.health,
        actorState.armor = thing.armor,
        actorState.actorId = thing.id
    CREATE (actorState)-[:IN_SUBSECTOR]->(subsector)

    // Hacky logic...hold your nose
    FOREACH (_ IN CASE thing.id WHEN event.actor.id
        THEN [1] ELSE [] END | CREATE (actorState)-[:ACTOR_IN]->(ev))
    FOREACH (_ IN CASE thing.id WHEN event.target.id
        THEN [1] ELSE [] END | CREATE (actorState)-[:TARGET_IN]->(ev))
    FOREACH (_ IN CASE thing.type WHEN 'player'
        THEN [1] ELSE [] END | SET actor:Player, actorState:PlayerState)
    FOREACH (_ IN CASE thing.type WHEN 'player'
        THEN [] ELSE [1] END | SET actor:Enemy, actorState:EnemyState)
)`

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
