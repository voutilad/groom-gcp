const dgram = require('dgram')
const { PubSub } = require('@google-cloud/pubsub')

const TOPIC = 'test-topic'
const PROJECT = 'neo4j-se-team-201905'
const KEY = './secrets/neo4j-se-team-201905-208a5b2ddcc7.json'

const client = new PubSub({
  projectId: PROJECT,
  keyFilename: KEY,
})
const publisher = client.topic(TOPIC)

function createUdpServer(messageHandler) {
  const server = dgram.createSocket('udp4')

  server.on('error', (err) => {
    console.error(err)
    server.close()
  })

  server.on('message', (data, rinfo) => {
    console.log(`processing message from ${rinfo.address}:${rinfo.port}`)
    messageHandler(data)
      .then(resp => {
        const msg = Buffer.from(`OK: [${resp}]\n`)
        server.send(msg, rinfo.port, rinfo.address)
      })
  })

  server.on('listening', () => {
    const addr = server.address()
    console.log(`server listening on ${addr.address}:${addr.port}`)
  })

  server.on('close', () => {
    console.log(`closing server`)
  })

  return server
}

async function publish(data) {
  let resp = await publisher.publishMessage({ data })
  console.log(`published message(s): ${resp}`)
  return resp
}

createUdpServer(publish).bind(10666)
