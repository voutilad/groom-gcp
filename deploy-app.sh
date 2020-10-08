#!/bin/sh
APP_YAML="${APP_YAML:-app.yaml}"

if [ ! -r "${APP_YAML}" ]; then
    echo "APP_YAML not set or doesn't exist. Set to a valid YAML file describing the GAE app."
    exit 1
fi

echo "Trying to deploy app using config ${APP_YAML}..."

gcloud app deploy "${APP_YAML}"
