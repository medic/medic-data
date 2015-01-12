#!/bin/bash

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}
DEMOS_DB_DIR=${DEMOS_DB_DIR:-/var/lib/couchdb}

#echo 'calling get_db_dir.sh' 1>&2
#echo "$DEMOS_COUCHDB" 1>&2
#echo "$DEMOS_DB_DIR" 1>&2

exitError () {
    echo "Exiting: $1" 1>&2
    exit 1
}

if [ -d "$DEMOS_DB_DIR" ]; then
    echo "$DEMOS_DB_DIR"
    exit 0
fi

DIR=`curl -s -f "${DEMOS_COUCHDB}/_config/couchdb/database_dir" 2>/dev/null`

if [ $? == 0 ]; then
    # also remove quotes from json string
    DEMOS_DB_DIR=`echo "$DIR" | sed s/\"//g 2>/dev/null`
fi

if [ ! -d "$DEMOS_DB_DIR" ]; then
    exitError "Can't find directory ${DEMOS_DB_DIR}."
fi

echo "${DEMOS_DB_DIR}"
exit 0
