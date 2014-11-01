#!/bin/bash

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}
COUCH_URL=${DEMOS_COUCHDB}

#export COUCH_URL="${DEMOS_COUCHCB}/medic"
gardener "${DEMOS_COUCHDB}/medic" &
