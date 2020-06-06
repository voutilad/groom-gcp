const {PubSub} = require('@google-cloud/pubsub');

const TOPIC = 'test-subscription'
const PROJECT = 'neo4j-se-team-201905'
const KEY = './secrets/neo4j-se-team-201905-208a5b2ddcc7.json'

function listenForMessages(
  projectId = PROJECT,
  subscriptionName = TOPIC,
  timeout = 60,
)
{
  const pubsub = new PubSub({projectId, keyFilename: KEY});
  const subscription = pubsub.subscription(subscriptionName)

  let messageCount = 0
  const handler = message => {
    console.log(`Received message: ${message.id}: ${message.data}`)
    messageCount = messageCount + 1
    message.ack()
  }
  subscription.on('message', handler)

  setTimeout(() => {
    subscription.removeListener('message', handler)
    console.log(`${messageCount} message(s) received.`)
  }, timeout * 1000)
}

listenForMessages()
