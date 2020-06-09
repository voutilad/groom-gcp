const {PubSub} = require('@google-cloud/pubsub');

const TOPIC = 'test-subscription'
const PROJECT = 'neo4j-se-team-201905'
const KEY = '../secrets/neo4j-se-team-201905-208a5b2ddcc7.json'

function listenForMessages(
  projectId = PROJECT,
  subscriptionName = TOPIC,
  timeout = 60,
)
{
  const pubsub = new PubSub({projectId, keyFilename: KEY});
  const subscription = pubsub.subscription(subscriptionName, {
    batching: { maxMessages: 25 },
  })

  let messageCount = 0
  const handler = message => {
    let { id, data } = message
    let payload = JSON.parse(data)
    console.log(`received message ${id} with ${payload.batch.length} events`)
    messageCount = messageCount + 1
    message.ack()
  }
  subscription.on('message', handler)

  setTimeout(() => {
    subscription.removeListener('message', handler)
    console.log(`${messageCount} message(s) received.`)
  }, timeout * 1000)

  console.log(`subscribed to topic "${TOPIC}"`)
}

listenForMessages()
