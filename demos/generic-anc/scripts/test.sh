#!/bin/sh

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}
DEMOS_DB_DIR=${DEMOS_DB_DIR:-/var/lib/couchdb}

t () {
    echo ${DEMOS_COUCHDB}
    echo ${DEMOS_DB_DIR}
}

t
