#!/bin/bash

SELF="`basename $0`"
SELF_HOME="`dirname $0`"
PRELOAD_APP_DATA=${PRELOAD_APP_DATA-demos}
PRELOAD_APP_MARKET=${PRELOAD_APP_MARKET-alpha}
DIST_ARCHIVE=${DIST_ARCHIVE-medic-demos-${PRELOAD_APP_DATA}-${PRELOAD_APP_MARKET}.tar.xz}
DOWNLOAD_URL="http://staging.dev.medicmobile.org/downloads/demos/${DIST_ARCHIVE}"
DATE=`date +%Y%d%m%H%M%S`
TMPDIR=${TMPDIR:-/tmp/${DATE}}
DIR="$1"

source "${SELF_HOME}/functions.sh" 

usage () {
    echo "Downloads and installs demo databases to a local CouchDB directory."
    echo "Assumes CouchDB is not running."
    echo "Usage: $SELF <directory>"
    exit 1
}

if [ -z "$DIR" ]; then
    usage
fi

if [ ! -d "$DIR" ]; then
    exitError "Directory '$DIR' not found."
fi

# -L follows redirects
curl -L -f "$DOWNLOAD_URL" > "$TMPDIR/${DIST_ARCHIVE}" && \
cd "$TMPDIR" && \
tar xzf "${DIST_ARCHIVE}" && \
mv -v "${PRELOAD_APP_DATA}/"*.couch "$DIR" && \
echo "Done copying files." && \
echo "CouchDB can be safely started now.  Launch the app then check" && \
echo "/_active_tasks to verify views are generated." && \
exit 0

exit 1
