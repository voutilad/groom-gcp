#!/bin/sh
GCP_PROJECT=="${GCP_PROJECT:-neo4j-se-team-201905}"
GCP_REGION="${GCP_REGION:-northamerica-northeast1}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-groom-demo}"
GROOM_TOPIC="${GROOM_TOPIC:-groom}"
ENV_FILE="${ENV_FILE:-secrets/env.yaml}"

if [ ! -r "${ENV_FILE}" ]; then
    echo "ENV_FILE not set or doesn't exist. Set to a valid YAML file with environment vars for the cloud fn."
    exit 1
fi

echo "Trying to deploy function to listen to ${GROOM_TOPIC} in project ${GCP_PROJECT}"

gcloud functions deploy groom \
       --region="${GCP_REGION}" \
       --runtime=nodejs12 \
       --service-account="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com" \
       --env-vars-file="secrets/env.yaml" \
       --trigger-topic="${GROOM_TOPIC}"
