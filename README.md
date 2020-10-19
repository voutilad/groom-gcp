# Doom Graph (groom) in the Google Cloud

This project has a collection of tools for composing a collection and
ingestion pipeline in the Google Cloud for populating a Neo4j graph
database via [Doom](https://github.com/voutilad/chocolate-doom).

# Prerequisites

These apps were written for Node v12. They may work on earlier or
later versions, but you should really grab the latest Node v12 release
available to yourself. For local test/dev, just run: `npm i`.

# The WebSocket Collector

The provided WebSocket collector runs in GAE Flexible Environment. See
[app.yaml](./app.yaml).

Assuming you've got GAE enabled in a GCP environment (and all the
GCloud tooling), it should be a simple deploy using:

```bash
$ gcloud app deploy
```

## Running the WebSocket app locally

To run locally, set some env vars:

- `GROOM_TOPIC` -- PubSub topic to send the message
- `GCP_PROJECT` -- (optional) current GCloud project
- `GOOGLE_APPLICATION_CREDENTIALS` -- path to json private key for service account
- `HOST` -- host/ip to bind to (default: localhost)
- `PORT` -- port to bind to (default: 8000)
- `SSL_CERT` -- (optional) path to x509 cert pem file
- `SSL_KEY` -- (optional) path to x509 private key pem file

> Note: for deployment in GAE, set `HOST=0.0.0.0`

For local TLS testing, you can generate a local cert and key:

```bash
$ openssl req -x509 -newkey rsa:4096 -keyout secrets/key.pem \
	-out secrets/cert.pem -days 30 -nodes -subj '/CN=localhost'
```

Then, since it's the "default" app in the `package.json`, you can just
run:

```bash
$ npm start
```

# cloud function
Relies on having an env.yaml file defining:

- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `NEO4J_DATABASE`

The deploy script requires some actual environment variables for config:

- `ENV_FILE`
- `GROOM_TOPIC`
- `SERVICE_ACCOUNT_NAME`
- `GCP_PROJECT`
- `GCP_REGION`

Simply run:

```bash
$ ENV_YAML=<path to env.yaml> ./deploy-fn.sh
```


# UDP Collector

Originally, I had ported my usage of UDP streams to Google Cloud. The
original app still remains in this project and is provided in
Docker-friendly manner so you can easily spin it up in GCE on
Container-Optimized OS.

```bash
$ docker build -t groom-gcp-udp:latest .
```

It'll open a nodejs `dgram` server using `udp4`, listening for events
in datagrams, batching, and publishing to PubSub. It uses similar
environment variables as the WebSocket collector:

- `GROOM_TOPIC`
- `GCP_PROJECT`
- `GOOGLE_APPLICATION_CREDENTIALS`

And optionally:

- `GROOM_MAX_BATCH_SIZE`
- `GROOM_FLUSH_INTERVAL_MS`
