const schemaIndexes = [
  'CREATE INDEX frames FOR (f:Frame) ON (f.session, f.id)',
  'CREATE INDEX ON :Frame(millis)',
  'CREATE INDEX actors FOR (a:Actor) ON (a.session, a.id)',
  'CREATE INDEX actorSessions FOR (a:Actor) ON (a.session)',
  'CREATE INDEX ON :Actor(id)',
  'CREATE INDEX subsectors FOR (s:SubSector) ON (s.session, s.id)',
  'CREATE INDEX ON :Enemy(type)',
  'CREATE INDEX states FOR (s:State) ON (s.actorSession, s.actorId)',
]

const insertEvents =  `
MERGE (frame:Frame {tic: event.frame.tic, session: event.session})
    ON CREATE SET frame.millis = event.frame.millis
CREATE (ev:Event {type: event.type, counter: event.counter})
CREATE (ev)-[:OCCURRED_AT]->(frame)
// Conditionally process Actor and Target
FOREACH (thing IN [x IN [event.actor, event.target] WHERE x IS NOT NULL] |
    MERGE (actor:Actor {id: thing.id, session: event.session})
        ON CREATE SET actor.type = thing.type
    MERGE (subsector:SubSector {id: thing.position.subsector, session: event.session})
    CREATE (actorState:State)
    SET actorState.position = point(thing.position),
        actorState.angle = thing.position.angle,
        actorState.health = thing.health,
        actorState.armor = thing.armor,
        actorState.actorId = thing.id,
        actorState.actorSession = event.session
    CREATE (actorState)-[:IN_SUBSECTOR]->(subsector)
    // Hacky logic...hold your nose
    FOREACH (_ IN CASE thing.id WHEN event.actor.id
        THEN [1] ELSE [] END | CREATE (actorState)-[:ACTOR_IN]->(ev))
    FOREACH (_ IN CASE thing.id WHEN event.target.id
        THEN [1] ELSE [] END | CREATE (actorState)-[:TARGET_IN]->(ev))
    FOREACH (_ IN CASE thing.type WHEN "player"
        THEN [1] ELSE [] END | SET actor:Player, actorState:PlayerState)
    FOREACH (_ IN CASE thing.type WHEN "player"
        THEN [] ELSE [1] END | SET actor:Enemy, actorState:EnemyState)
)`

const threadFrames = `
MATCH (f:Frame) WHERE NOT (f)<-[:PREV_FRAME]-()
WITH f ORDER BY f.tic
WITH collect(f) AS frames
UNWIND apoc.coll.pairsMin(frames) AS pair
WITH pair[0] AS prev, pair[1] AS next
    CREATE (next)-[:PREV_FRAME]->(prev)
`

const threadEvents = `
MATCH (e:Event) WHERE NOT (e)<-[:PREV_EVENT]-()
WITH e ORDER BY e.counter
WITH collect(e) AS events
UNWIND apoc.coll.pairsMin(events) AS pair
WITH pair[0] AS prev, pair[1] AS next
    CREATE (next)-[:PREV_EVENT]->(prev)
`

const threadStates = `
MATCH (a:Actor)
MATCH (s:State {actorId:a.id, actorSession:a.session})-[:ACTOR_IN|:TARGET_IN]->(e:Event)
    WHERE NOT (s)<-[:PREV_STATE]-()
WITH s, e ORDER BY e.counter
WITH collect(s) AS states, s.actorId AS actorId
UNWIND apoc.coll.pairsMin(states) AS pair
WITH pair[0] AS prev, pair[1] AS next
    CREATE (next)-[:PREV_STATE]->(prev)
`

const currentStateDelete = `
MATCH (a:Actor)-[r:CURRENT_STATE]->(old:State) DELETE r
`

const currentStateUpdate = `
MATCH (s:State) WHERE NOT (s)<-[:PREV_STATE]-()
MATCH (a:Actor {id:s.actorId, session:s.actorSession})
MERGE (a)-[:CURRENT_STATE]->(s)
`

const initialState = `
MATCH (a:Actor)-[:CURRENT_STATE]->(:State) WHERE NOT (a)-[:INITIAL_STATE]->(:State)
WITH a
MATCH (a)-[:CURRENT_STATE]->(:State)-[:PREV_STATE*]->(first:State)
WHERE NOT (first)-[:PREV_STATE]->(:State)
MERGE (a)-[:INITIAL_STATE]->(first)
`

module.exports = {
  schemaIndexes,
  insertEvents,
  threadFrames,
  threadEvents,
  threadStates,
  currentStateDelete,
  currentStateUpdate,
  initialState,
}
