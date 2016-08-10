QMAKE := ${MAKE} --no-print-directory
QCURL := curl -s -f -L
DEMOS_COUCHDB := $(shell ./scripts/set_admin.sh)
DEMOS_DB_DIR = $(shell DEMOS_COUCHDB="${DEMOS_COUCHDB}" ./scripts/get_db_dir.sh)
COUCHDB_OWNER ?= couchdb:couchdb
PRELOAD_APP_DATA ?= diy
PRELOAD_APP_MARKET ?= diy
PRELOAD_APP_MARKET_URL ?= https://staging.dev.medicmobile.org
DEMOS_DATA_DIR ?= ./data/generic-anc/${PRELOAD_APP_DATA}
DIST_DIR ?= dist
DIST_ARCHIVE ?= medic-demos-${PRELOAD_APP_DATA}-${PRELOAD_APP_MARKET}.tar.xz
DASHBOARD_URL ?= https://staging.dev.medicmobile.org/downloads/demos/dashboard-medic-develop.couch
UPLOAD_DB_URL ?= ${DEMOS_COUCHDB}/downloads
DATE = $(shell date +%Y%d%m)

.PHONY: test

all: install settings gardener load compact copy archive

init:
	@echo `date -u '+%FT%T%Z - log: '` Initializing...
	@${QCURL} "${DEMOS_COUCHDB}/_session" > /dev/null
	@test -d "${DEMOS_DB_DIR}"
	@mkdir -p tmp
	@test -z "${TEST_ENV}"
	@echo `date -u '+%FT%T%Z - log: '` 'Confirm delayed commits is disabled...'
	@${QCURL} --data '"false"' -X PUT \
	  "${DEMOS_COUCHDB}/_config/couchdb/delayed_commits" > /dev/null
	@echo `date -u '+%FT%T%Z - log: '` 'Maximize file compression setting...'
	@${QCURL} --data '"none"' -X PUT \
	  "${DEMOS_COUCHDB}/_config/couchdb/file_compression" > /dev/null

test: init
	DEMOS_COUCHDB="${DEMOS_COUCHDB}" ./scripts/test.sh

install: init
	npm install
	@echo `date -u '+%FT%T%Z - log: '` 'Installing Garden20 Dashboard...'
	@if [ ! -f "tmp/dashboard.couch" ]; then \
	  ${QCURL} "${DASHBOARD_URL}" > tmp/dashboard.couch; \
	fi
	@sudo cp tmp/dashboard.couch "${DEMOS_DB_DIR}"
	@sudo chown "${COUCHDB_OWNER}" "${DEMOS_DB_DIR}/dashboard.couch"
	@echo `date -u '+%FT%T%Z - log: '` 'Restarting CouchDB...'
	@${QCURL} -H "Content-Type: application/json" \
		  -X POST "${DEMOS_COUCHDB}/_restart" > /dev/null
	@while ! test `curl -f -s "${DEMOS_COUCHDB}"`; do \
	  echo `date -u '+%FT%T%Z - log: '` 'Waiting for couchdb to return...' && sleep 2; \
	done
	@echo `date -u '+%FT%T%Z - log: '` \
	  "Installing Medic Mobile ${PRELOAD_APP_MARKET}..."
	@garden-core \
	  "${PRELOAD_APP_MARKET_URL}/markets-${PRELOAD_APP_MARKET}/details/medic" \
	  "${DEMOS_COUCHDB}"
	@echo `date -u '+%FT%T%Z - log: '` \
	  'Installing Medic Mobile Reporter ${PRELOAD_APP_MARKET}...'
	@garden-core \
	  "${PRELOAD_APP_MARKET_URL}/markets-${PRELOAD_APP_MARKET}/details/medic-reporter" \
	  "${DEMOS_COUCHDB}"
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

settings: init
	DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	  node ./scripts/load_settings.js \
	    "${DEMOS_DATA_DIR}/app-settings" \
	    "${DEMOS_DATA_DIR}/forms" \
	    "${DEMOS_DATA_DIR}/before_load"

gardener: init
	@echo `date -u '+%FT%T%Z - log: '` 'Starting Gardener...'
	@cd tmp && \
	DEMOS_COUCHDB="${DEMOS_COUCHDB}" ../scripts/run_gardener.sh
	@sleep 15
	@tail tmp/logs/*

load: init
	@DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	  node ./scripts/load_facilities.js "${DEMOS_DATA_DIR}/facilities"
	@DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	  node ./scripts/load_messages.js "${DEMOS_DATA_DIR}/messages"
	@DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	  node ./scripts/wait_for_updates.js couchmark
	@DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	  node ./scripts/wait_for_updates.js medic
	@DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	  node ./scripts/wait_for_updates.js medic-audit
	@DEMOS_COUCHDB="${DEMOS_COUCHDB}" \
	  node ./scripts/load_settings.js \
	    "${DEMOS_DATA_DIR}/app-settings" \
	    "${DEMOS_DATA_DIR}/forms"
	@if [ -f "tmp/gardener.PID" ]; then \
	  echo 'Stopping gardener...' && \
	  kill `cat tmp/gardener.PID` && \
	  rm tmp/gardener.PID; \
	fi

compact: init
	@echo `date -u '+%FT%T%Z - log: '` 'Compacting dbs...'
	@for i in dashboard medic medic-reporter couchmark medic-audit; do \
	  curl -s -L \
	    -H "Content-Type: application/json" -X POST \
	    "${DEMOS_COUCHDB}/$$i/_compact"; \
	done
	@while test "`curl -s ${DEMOS_COUCHDB}/_active_tasks | grep -v '\[\]'`"; do \
	  echo `date -u '+%FT%T%Z - log: '` \
	    'Waiting for active tasks to finish...' && sleep 3; \
	done

copy: init 
	@echo `date -u '+%FT%T%Z - log: '` 'Copying database files...'
	@mkdir -p "${DIST_DIR}/${PRELOAD_APP_DATA}"
	sudo ls -al "${DEMOS_DB_DIR}"
	@for i in dashboard medic medic-reporter; do \
	  sudo cp "${DEMOS_DB_DIR}/$$i.couch" "${DIST_DIR}/${PRELOAD_APP_DATA}"; \
	done
	@if [ -f "${DEMOS_DB_DIR}/medic-audit.couch" ]; then \
	  sudo cp "${DEMOS_DB_DIR}/medic-audit.couch" "${DIST_DIR}/${PRELOAD_APP_DATA}"; \
	fi
	@if [ -f "${DEMOS_DB_DIR}/couchmark.couch" ]; then \
	  sudo cp "${DEMOS_DB_DIR}/couchmark.couch" "${DIST_DIR}/${PRELOAD_APP_DATA}"; \
	fi

copy-views: init
	@echo 'Copying view files...'
	mkdir -p "${DIST_DIR}/${PRELOAD_APP_DATA}"
	sudo ls -alR "${DEMOS_DB_DIR}"
	for i in medic couchmark medic-audit; do \
	  sudo echo "${DEMOS_DB_DIR}/.$${i}_design"; \
	  sudo ls "${DEMOS_DB_DIR}/.$${i}_design"; \
	  sudo cp -R "${DEMOS_DB_DIR}/.$${i}_design" "${DIST_DIR}/${PRELOAD_APP_DATA}"; \
	done

archive: init
	@echo `date -u '+%FT%T%Z - log: '` 'Creating archive...'
	@cd dist && \
	tar cf - "${PRELOAD_APP_DATA}" | xz -9ec > "${DIST_ARCHIVE}"
	@echo `date -u '+%FT%T%Z - log: '` 'Done.'

upload:
	@test -f "${DIST_DIR}/${DIST_ARCHIVE}"
	@./scripts/upload.sh '${UPLOAD_DB_URL}' "${DIST_DIR}/${DIST_ARCHIVE}"


reset:
	@echo 'Deleting databases...'
	@curl -X DELETE "${DEMOS_COUCHDB}/dashboard"
	@curl -X DELETE "${DEMOS_COUCHDB}/medic"
	@curl -X DELETE "${DEMOS_COUCHDB}/medic-reporter"
	@curl -X DELETE "${DEMOS_COUCHDB}/couchmark"
	@curl -X DELETE "${DEMOS_COUCHDB}/medic-audit"
	@echo 'Deleting demos admin...'
	@curl -X DELETE "${DEMOS_COUCHDB}/_config/admins/demos"
	@if [ -f "tmp/gardener.PID" ]; then \
	  echo 'Stopping gardener...' && \
	  kill `cat tmp/gardener.PID` && \
	  rm tmp/gardener.PID; \
	fi

clean: reset
	sudo rm -rf dist tmp

