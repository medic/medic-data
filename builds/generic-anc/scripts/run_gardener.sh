#!/bin/bash

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}

export COUCH_URL="${DEMOS_COUCHDB}/medic"
echo "COUCH_URL is ${COUCH_URL}"
gardener "${DEMOS_COUCHDB}/medic" &
