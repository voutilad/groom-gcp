const CypherSink = require('neo4j-serverless-functions/cud/CypherSink')


exports.groom = async (event, context) => {
  let { eventId } = context

  try {
    let { data } = event
    let payload = JSON.parse(Buffer.from(data, 'base64').toString())
    console.log(`processing ${eventId} with ${payload.batch.length} events`)
    let sink = new CypherSink(payload)

    console.log(`writing data to ${process.env.NEO4J_URI || "UNDEFINED!!!"}`)
    let results = await sink.run()
    console.log(`ingestion results: ${results}`)
  } catch (e) {
    console.error(e)

  }
}
