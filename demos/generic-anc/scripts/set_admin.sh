#!/bin/bash 
# 
# If in admin party set an admin, otherwise leave auth as-is.
#

DEMOS_COUCHDB=${DEMOS_COUCHDB:-http://localhost:5984}

exitError () {
    echo "Exiting: $1"
    exit 1
}

setAdmin () {
    curl -s --fail \
        -X PUT \
        -d '"secret"' \
        ${DEMOS_COUCHDB}/_config/admins/demos
}

SESSION=`curl -s --fail ${DEMOS_COUCHDB}/_session`
if [ $? != 0 ]; then
    exitError "Failed to query session on ${DEMOS_COUCHDB}."
fi

echo "$SESSION" | grep '"name":null' > /dev/null
if [ $? == 0 ]; then
    echo "$SESSION" | grep '"roles":\["_admin"' > /dev/null
    if [ $? == 0 ]; then
        echo 'Couchdb is in admin party mode, creating admin user...' 1>&2
        setAdmin && \
        DEMOS_COUCHDB='http://demos:secret@localhost:5984' || \
        exitError 'Failed to create admin user.'
    fi
fi

echo "$DEMOS_COUCHDB"
exit 0
