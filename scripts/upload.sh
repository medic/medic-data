#!/bin/bash

DATE=`date +%Y%d%m%H%M` 
DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}
UPLOAD_DASHBOARD_URL=${UPLOAD_DASHBOARD_URL:-${DEMOS_COUCHDB}/dashboard}
DIST_DIR=${DIST_DIR:-dist}
DIST_ARCHIVE=${DIST_ARCHIVE:-medic-demos-${DATE}.tgz}

exitError () {
    echo "Exiting: $1"
    exit 1
}

upload () {
    local rev=`curl -s -I -XHEAD "${UPLOAD_DASHBOARD_URL}/_design/dashboard" | grep -Fi etag | sed 's/.*: //'`
    # remove quotes and new lines
    rev=`echo "$rev" | sed 's/\"//g' | tr -d '\n' | tr -d '\r'`
    curl -f -k -X PUT -H "Content-Type: application/octet-stream" \
        --data-binary "@${DIST_DIR}/${DIST_ARCHIVE}" \
        "${UPLOAD_DASHBOARD_URL}/_design/dashboard/${DIST_ARCHIVE}?rev=${rev}"
}

if [ -n "$TRAVIS" ]; then
    if [ "$TRAVIS_PULL_REQUEST" != "false" ]; then
        echo 'Not uploading on pull requests.'
        exit 0
    fi
fi

upload
