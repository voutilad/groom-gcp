/* global process */
const {PubSub} = require('@google-cloud/pubsub');

const SUBSCRIPTION = process.env.GROOM_SUBSCRIPTION || 'groom-sub'
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT
const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS

function listenForMessages(
  projectId = PROJECT,
  subscriptionName = SUBSCRIPTION,
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

  console.log(`subscribed to "${SUBSCRIPTION}"`)
}

listenForMessages()
