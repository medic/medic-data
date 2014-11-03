
QMAKE := ${MAKE} --no-print-directory
QCURL := curl -s -f
DEMOS_COUCHDB := $(shell ./scripts/set_admin.sh)
DEMOS_DB_DIR = $(shell DEMOS_COUCHDB="${DEMOS_COUCHDB}" ./scripts/get_db_dir.sh)
COUCHDB_OWNER ?= couchdb:couchdb
PRELOAD_APP_DATA ?= diy
DEMOS_DATA_DIR ?= ../../generic-anc/${PRELOAD_APP_DATA}
DIST_DIR ?= dist
DIST_ARCHIVE ?= medic-demos-${PRELOAD_APP_DATA}.tgz
BETA_MM ?= http://staging.dev.medicmobile.org/markets-beta/details/medic
BETA_REPORTER ?= http://staging.dev.medicmobile.org/markets-beta/details/medic-reporter
DASHBOARD ?= http://staging.dev.medicmobile.org/downloads/dashboard-medic.couch
UPLOAD_DASHBOARD_URL ?= https://travis-ci:a5nghmongP!@staging.dev.medicmobile.org/dashboard
DATE = $(shell date +%Y%d%m)

.PHONY: test

all: install listen load compact copy upload

init:
	@echo "Initializing..."
	@${QCURL} "${DEMOS_COUCHDB}/_session" > /dev/null
	test -d "${DEMOS_DB_DIR}"
	mkdir -p tmp
	test -z "${TEST_ENV}"

test:	init
	DEMOS_COUCHDB="${DEMOS_COUCHDB}" ./scripts/test.sh

install: init
	npm install
	@echo 'Installing Garden20 Dashboard...'
	@${QCURL} "${DASHBOARD}" > tmp/dashboard.couch
	@sudo mv tmp/dashboard.couch "${DEMOS_DB_DIR}"
	@sudo chown "${COUCHDB_OWNER}" "${DEMOS_DB_DIR}/dashboard.couch"
	@curl -H "Content-Type: application/json" -X POST "${DEMOS_COUCHDB}/_restart"
	@sleep 5 
	@echo 'Installing Medic Mobile...'
	@garden-core "${BETA_MM}" ${DEMOS_COUCHDB}
	@echo 'Installing Medic Mobile Reporter...'
	@garden-core "${BETA_REPORTER}" ${DEMOS_COUCHDB}
	@echo 'Set Medic Mobile security to public...'
	@${QCURL} -X PUT \
	    -H "Content-Type: application/json" \
	    -d '{"admins":{"names":[],"roles":[]},"members":{"names":[],"roles":[]}}' \
	    "${DEMOS_COUCHDB}/medic/_security"
	@echo 'Set Medic Mobile Reporter security to public...'
	@${QCURL} -X PUT \
	    -H "Content-Type: application/json" \
	    -d '{"admins":{"names":[],"roles":[]},"members":{"names":[],"roles":[]}}' \
	    "${DEMOS_COUCHDB}/medic-reporter/_security"

listen: init
	@DEMOS_COUCHDB="${DEMOS_COUCHDB}" node ./scripts/load_settings.js "${DEMOS_DATA_DIR}/app-settings.json" "${DEMOS_DATA_DIR}/forms.json"
	@echo 'Starting Gardener...'
	@cd tmp && \
	COUCH_URL="${DEMOS_COUCHDB}/medic" gardener "${DEMOS_COUCHDB}/medic" &
	sleep 15
	tail tmp/logs/*

load:	init
	@echo 'Disabling delayed commits so db syncs to disk per request...'
	${QCURL} --data '"false"' -X PUT \
	    "${DEMOS_COUCHDB}/_config/couchdb/delayed_commits"
	@DEMOS_COUCHDB=${DEMOS_COUCHDB} \
	    node ./scripts/load_facilities.js "${DEMOS_DATA_DIR}/facilities.json"
	@DEMOS_COUCHDB=${DEMOS_COUCHDB} \
	    node ./scripts/load_messages.js "${DEMOS_DATA_DIR}/messages.json"
	@DEMOS_COUCHDB=${DEMOS_COUCHDB} \
	    node ./scripts/wait_for_sentinel.js

compact: init
	@echo 'Compacting dbs...'
	@for i in dashboard medic medic-reporter couchmark; do \
	    ${QCURL} \
		-H "Content-Type: application/json" \
		-X POST \
		"${DEMOS_COUCHDB}/$$i/_compact"; \
	done

copy:   init 
	@echo 'Copying .couch files...'
	mkdir -p "${DIST_DIR}/${PRELOAD_APP_DATA}"
	@for i in dashboard.couch medic.couch medic-reporter.couch couchmark.couch; do \
	    sudo cp "${DEMOS_DB_DIR}/$$i" "${DIST_DIR}/${PRELOAD_APP_DATA}"; \
	done

archive: init 
	@echo 'Creating archive...'
	@cd dist && tar zcf "${DIST_ARCHIVE}" "${PRELOAD_APP_DATA}"

upload: init archive
	@echo "Uploading..."
	test -f "dist/${DIST_ARCHIVE}"
	@DIST_DIR="${DIST_DIR}" \
	DIST_ARCHIVE="${DIST_ARCHIVE}" \
	DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	UPLOAD_DASHBOARD_URL="${UPLOAD_DASHBOARD_URL}" \
	./scripts/upload.sh
	echo "done: http://staging.dev.medicmobile.org/downloads/demos/${DIST_ARCHIVE}"

reset:
	@echo 'Deleting databases...'
	@curl -X DELETE "${DEMOS_COUCHDB}/dashboard"
	@curl -X DELETE "${DEMOS_COUCHDB}/medic"
	@curl -X DELETE "${DEMOS_COUCHDB}/medic-reporter"
	@curl -X DELETE "${DEMOS_COUCHDB}/couchmark"
	@echo 'Deleting demos admin...'
	@curl -X DELETE "${DEMOS_COUCHDB}/_config/admins/demos"

clean: reset
	rm -rf dist tmp
	
