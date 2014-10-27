#!/bin/sh -x

STAGING_DB='http://travis-ci:a5nghmongP!@staging.dev.medicmobile.org/dashboard'
DIST_COUCH_FILE='../dist/demos-generic-anc.couch'

function uploadDB {
    local rev=`curl -I -XHEAD "${STAGING_DB}/_design/dashboard" | grep -Fi etag | sed 's/.*: //'`
    # remove quotes and new lines
    rev=`echo "$rev" | sed 's/\"//g' | tr -d '\n' | tr -d '\r'`
    if [ ! -f "$DIST_COUCH_FILE" ]; then
        exitError "Missing couch file: $DIST_COUCH_FILE"
    fi
    curl -v -X PUT -H "Content-Type: application/octet-stream" \
        --data-binary "@${DIST_COUCH_FILE}" \
        "${STAGING_DB}/_design/dashboard/demos-generic-anc.couch?rev=${rev}"
}

uploadDB
