/* global process, Promise */
const neo4j = require('neo4j-driver')
const getopt = require('./vendor/getopt')
const cypher = require('./cypher')

let usage = () => {
  console.log(`usage: node schema.js [-a address] [-d database] [-u user] [-p password]`)
  process.exit(1)
}

let parser = new getopt.BasicParser('a:(address)u:(user)p:(password)d:(database)', process.argv)

let uri = 'bolt://localhost:7687'
let user = 'neo4j'
let pass = 'password'
let db = 'neo4j'
let option

while ((option = parser.getopt()) !== undefined) {
  switch (option.option) {
  case 'a':
    uri = option.optarg
    break;
  case 'u':
    user = option.optarg
    break;
  case 'p':
    pass = option.optarg
    break;
  case 'd':
    db = option.optarg
    break;
  default:
    usage()
  }
}

let blastoff = async () => {
  let driver = neo4j.driver(uri, neo4j.auth.basic(user, pass))
  let session = driver.session({ database: db })

  try {
    await session.writeTransaction(async tx => {
      cypher.schemaIndexes.map(async q => {
        console.log(`Executing schema query: ${q}`)
        try {
          await tx.run(q)
        } catch (e) {
          if (!e.message.startsWith('An equivalent index already exists'))
            console.error(`failed to set schema using:\n${q}\n${e}`)
          else
            console.log(`Already set ${q}`)
        }
      })
    })
  } catch (e) {
    //console.error(`errors setting schema: ${e}`)
  }

  await session.close()
  await driver.close()
}

blastoff().then(() => {
  console.log('Schema Complete')
})
