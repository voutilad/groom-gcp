/* global process */
const _ = require('lodash')
const Promise = require('bluebird')

const { CypherSink, neo4j } = require('neo4j-serverless-functions/gil')
const cypher = require('../cypher')

exports.groom = async (event, context) => {
  let { eventId } = context

  /* Initial batch event insertion using the Cypher-based update approach.
   * The cypher provided by the gateway app is responsible for
   */
  try {
    let { data } = event
    let payload = JSON.parse(Buffer.from(data, 'base64').toString())
    console.log(`processing "${eventId}" with ${payload.batch.length} events`)
    // let sink = new CypherSink(payload)

    console.log(`writing data to ${process.env.NEO4J_URI || "UNDEFINED!!!"}`)
    let results = await new CypherSink(payload).run()
    console.log(`ingestion result: ${JSON.stringify(results)}`)
  } catch (e) {
    console.error(e)
    return false
  }

  /* Post-processing e.g. threading, etc.
   * This should be simplified or maybe put into its own function.
   */
  try {
    const session = neo4j.getDriver().session()
    session.writeTransaction(async tx => {
      let postProcessingResults = await Promise.mapSeries(
        // run each of our post-processing queries in series
        [
          tx.run(cypher.threadEvents),
          tx.run(cypher.threadFrames),
          tx.run(cypher.threadStates),
          tx.run(cypher.currentStateDelete),
          tx.run(cypher.currentStateUpdate),
          tx.run(cypher.initialState),
        ],
        // grab the stats on database updates
        (result) => {
          return result.summary.counters.updates()
        })
      // return the update summaries merged through basic addition
      return _.merge(...postProcessingResults, (x, y) => (x || 0) + (y || 0))
    }).then(result => {
      console.log(`post-processing result: ${JSON.stringify(result)}`)
      return result
    }).catch(console.error)
      .finally(session.close)
  } catch (e) {
    console.error(e)
    return false;
  }

  return true;
}
