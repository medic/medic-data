#!/bin/bash

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}

export COUCH_URL="${DEMOS_COUCHCB}/medic"
gardener "${DEMOS_COUCHDB}/medic" &
