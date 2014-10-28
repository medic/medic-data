#!/bin/sh

DEMOS_DB=${DEMOS_DB:-http://localhost:5984/medic}
DEMOS_COUCH=${DEMOS_COUCH:-http://localhost:5984}
DEMOS_DB_DIR=${DEMOS_DB_DIR:-/var/lib/couchdb}

DIST_COUCH_FILE='../dist/demos-generic-anc.couch'

function exitError {
    echo "\n$1"
    exit 1
}

function copyDB {
    local db_name=`basename "$DEMOS_DB"`
    local db_path="${DEMOS_DB_DIR}/${db_name}.couch"
    local dir=`dirname "$DIST_COUCH_FILE"`
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir" || exitError "Failed to create dir: $dir"
    fi
    if [ ! -f "$db_path" ]; then
        exitError "Database not found: $db_path"
    fi
    cp "$db_path" "$DIST_COUCH_FILE"
}

# Query couchdb for database filesystem path if not found
if [ ! -d "$DEMOS_DB_DIR" ]; then
    # also remove quotes from json string
    DEMOS_DB_DIR=`curl -s "${DEMOS_COUCH}/_config/couchdb/database_dir" | sed s/\"//g`
    if [ ! -d "$DEMOS_DB_DIR" ]; then
        exitError "CouchDB database directory not found: $DEMOS_DB_DIR"
    fi
fi

# Disabled delayed commits so couchdb syncs to disk per request
curl -s --data '"false"' -X PUT \
    "${DEMOS_COUCH}/_config/couchdb/delayed_commits" && \
node ./scripts/load.js &&
copyDB
