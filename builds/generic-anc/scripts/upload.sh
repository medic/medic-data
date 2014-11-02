#!/bin/bash

DATE=`date +%Y%d%m`
DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}
UPLOAD_DASHBOARD_URL=${UPLOAD_DASHBOARD_URL:-${DEMOS_COUCHDB}/dashboard}
DIST_DIR=${DIST_DIR:-dist}
DIST_ARCHIVE=${DIST_ARCHIVE:-dist-latest.tgz}

exitError () {
    echo "Exiting: $1"
    exit 1
}

upload () {
    test -f "$DIST_ARCHIVE" || exitError "Archive file not found."
    local rev=`curl -s -I -XHEAD "${UPLOAD_DASHBOARD_URL}/_design/dashboard" | grep -Fi etag | sed 's/.*: //'`
    # remove quotes and new lines
    rev=`echo "$rev" | sed 's/\"//g' | tr -d '\n' | tr -d '\r'`
    curl -f -k -X PUT -H "Content-Type: application/octet-stream" \
        --data-binary "@${DIST_ARCHIVE}" \
        "${UPLOAD_DASHBOARD_URL}/_design/dashboard/${DIST_ARCHIVE}?rev=${rev}"
}

if [ -n "$TRAVIS" ]; then
    if [ "$TRAVIS_PULL_REQUEST" != "false" ]; then
        echo 'Not uploading on pull requests.'
        exit 0
    fi
fi

tar zcf "$DIST_ARCHIVE" "$DIST_DIR" || \
exitError "Failed to create archive."

upload
