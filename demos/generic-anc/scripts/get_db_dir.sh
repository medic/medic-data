#!/bin/sh 

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}
DEMOS_DB_DIR=${DEMOS_DB_DIR:-/var/lib/couchdb}

if [ -d "$DEMOS_DB_DIR" ]; then
    echo "$DEMOS_DB_DIR"
    exit 0
fi

# also remove quotes from json string
DEMOS_DB_DIR=`curl -s "${DEMOS_COUCHDB}/_config/couchdb/database_dir" | sed s/\"//g`
if [ ! -d "$DEMOS_DB_DIR" ]; then
    echo "CouchDB database directory not found: $DEMOS_DB_DIR" 1>&2
    exit 1
fi

echo "$DEMOS_DB_DIR"
exit 0
