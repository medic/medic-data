#!/bin/sh

set -o pipefail

SELF="`basename $0`"
SELF_HOME="`dirname $0`"
COUCH_URL=${COUCH_URL-$1}
TMPDIR=${TMPDIR-/tmp/medic-servers-data}

_exit_fail () {
    echo "exiting: $1" 1>&2
    exit 1
}

_warn () {
    echo "warning: $1" 1>&2
}

_get_doc () {
  local db=$1
  local uuid=$2
  if [ -z "$db" ]; then
      echo "please define db parameter"
      return 1
  fi
  if [ -z "$uuid" ]; then
      echo "please define uuid parameter"
      return 1
  fi
  curl -k -s -S -f "$COUCH_URL/$db/$uuid"
}

_put_doc () {
  local db=$1
  local uuid=$2
  if [ -z "$db" ]; then
      echo "please define db parameter"
      return 1
  fi
  if [ -z "$uuid" ]; then
      echo "please define uuid parameter"
      return 1
  fi
  curl -k -s -S -f -X PUT -d @- "$COUCH_URL/$db/$uuid"
}

_usage () {
    echo ""
    echo "Usage:"
    echo "  $SELF <url>"
    echo "  Requires a url parameter or COUCH_URL environment var."
    echo ""
    echo "Examples:"
    echo "  $SELF 'http://admin:123qwe!$@192.168.21.201' # quote special characters"
    echo "  $SELF http://admin@192.168.21.201 # prompt for password"
    echo ""
}

if [ -z "$COUCH_URL" ]; then
    _usage
    _exit_fail "Please define COUCH_URL or provide the parameter."
fi

if [ ! -d "$TMPDIR" ]; then
    mkdir "$TMPDIR" || _exit_fail "Failed to create temp dir."
fi

_to_ssl () {
    local file=$1
    sed -i.bak 's/http:\/\/staging.dev.medicmobile.org/https:\/\/staging.dev.medicmobile.org/g' \
        "$file"
}

_to_release_market () {
    local file=$1
    sed -i.bak 's/market_1\/_db/market\/_db/g' "$file" && \
    sed -i.bak 's/market_2\/_db/market\/_db/g' "$file" && \
    sed -i.bak 's/markets-beta/markets-release/g' "$file" && \
    sed -i.bak 's/markets-alpha/markets-release/g' "$file" 
}

_to_alpha_market () {
    local file=$1
    sed -i.bak 's/market\/_db/market_2\/_db/g' "$file" && \
    sed -i.bak 's/market_1\/_db/market_2\/_db/g' "$file" && \
    sed -i.bak 's/markets-release/markets-alpha/g' "$file" && \
    sed -i.bak 's/markets-beta/markets-alpha/g' "$file" 
}

curl -k -s -S -f "$COUCH_URL/dashboard/_design/dashboard/_view/get_markets" > \
    "$TMPDIR/markets.json" && \
    grep '"id":' "$TMPDIR/markets.json" > "$TMPDIR/market_docs.json" && \
    sed -i.bak 's/.*id":"\(.*\)","key.*/\1/g' "$TMPDIR/market_docs.json" || \
    exit 1

for uuid in `cat "$TMPDIR/market_docs.json"`; do
    _get_doc dashboard $uuid > "${TMPDIR}/${uuid}.json"
    _to_ssl "${TMPDIR}/${uuid}.json" && \
    _to_release_market "${TMPDIR}/${uuid}.json" && \
    cat "${TMPDIR}/${uuid}.json" | _put_doc dashboard $uuid
done

echo "migration complete."
exit 0
