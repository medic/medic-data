#!/bin/bash

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}
export COUCH_URL="${DEMOS_COUCHDB}/medic"
gardener "${DEMOS_COUCHDB}/medic" &
echo "$!" > gardener.PID
echo "gardener PID `cat gardener.PID`"
