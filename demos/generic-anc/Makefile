
QMAKE := ${MAKE} --no-print-directory
QCURL = curl -s -f
DEMOS_COUCHDB = $(shell ./scripts/set_admin.sh)
DEMOS_DB_DIR = $(shell ./scripts/get_db_dir.sh)
DIST_DIR = dist
BETA_MM = http://staging.dev.medicmobile.org/markets-beta/details/medic
BETA_REPORTER = http://staging.dev.medicmobile.org/markets-beta/details/medic-reporter
DASHBOARD = http://staging.dev.medicmobile.org/downloads/dashboard-medic.couch

all: init install listen load compact copy upload

install: init
	@echo 'Installing Garden20 Dashboard...'
	${QCURL} "${DASHBOARD}" > tmp/dashboard.couch
	@if [ -n "${IS_TRAVIS}" ]; then \
	    sudo mv tmp/dashboard.couch "${DEMOS_DB_DIR}"; \
	else \
	    mv tmp/dashboard.couch "${DEMOS_DB_DIR}"; \
	fi
	@${QCURL} \
	    -H "Content-Type: application/json" \
	    -X POST \
	    "${DEMOS_COUCHDB}/_restart" && \
	sleep 5
	@echo 'Installing Medic Mobile...'
	garden-core "${BETA_MM}" ${DEMOS_COUCHDB}
	@echo 'Installing Medic Mobile Reporter...'
	garden-core "${BETA_REPORTER}" ${DEMOS_COUCHDB}
	@echo 'Set Medic Mobile security to public...'
	${QCURL} -X PUT \
	    -H "Content-Type: application/json" \
	    -d '{"admins":{"names":[],"roles":[]},"members":{"names":[],"roles":[]}}' \
	    "${DEMOS_COUCHDB}/medic/_security"
	@echo 'Set Medic Mobile Reporter security to public...'
	${QCURL} -X PUT \
	    -H "Content-Type: application/json" \
	    -d '{"admins":{"names":[],"roles":[]},"members":{"names":[],"roles":[]}}' \
	    "${DEMOS_COUCHDB}/medic-reporter/_security"

listen:
	echo 'Starting Gardener...'
	echo 'todo: upload settings first since sentinel needs them'
	cd tmp && \
	../scripts/run_gardener.sh

load:
	@echo 'Loading demo data...'
	@echo 'Disabling delayed commits so db syncs to disk per request...'
	${QCURL} --data '"false"' -X PUT \
	    "${DEMOS_COUCHDB}/_config/couchdb/delayed_commits"
	node ./scripts/load.js
	@echo 'Wait for sentinel to finish...'
	sleep 25

upload:
	./scripts/upload.sh

init:
	@echo "Initializing..."
	@echo "${DEMOS_COUCHDB}"
	test -d "${DEMOS_DB_DIR}"
	ls -al "${DEMOS_DB_DIR}"
	mkdir -p tmp

compact:
	@echo 'Compacting dbs...'
	for i in dashboard medic medic-reporter couchmark; do \
	    ${QCURL} \
		-H "Content-Type: application/json" \
		-X POST \
		"${DEMOS_COUCHDB}/$$i/_compact" "${DIST_DIR}"; \
	done

copy:
	test -d "${DEMOS_DB_DIR}"
	@echo 'Copying .couch files...'
	mkdir -p "${DIST_DIR}"
	for i in dashboard.couch medic.couch medic-reporter.couch couchmark.couch; do \
	    cp "${DEMOS_DB_DIR}/$$i" "${DIST_DIR}"; \
	done

reset:
	@echo 'Resetting...'
	@echo 'Deleting databases...'
	@${QCURL} "${DEMOS_COUCHDB}/dashboard" && \
	    ${QCURL} -X DELETE "${DEMOS_COUCHDB}/dashboard"
	@${QCURL} "${DEMOS_COUCHDB}/medic" && \
	    ${QCURL} -X DELETE "${DEMOS_COUCHDB}/medic"
	@${QCURL} "${DEMOS_COUCHDB}/medic-reporter" && \
	    ${QCURL} -X DELETE "${DEMOS_COUCHDB}/medic-reporter"
	@${QCURL} "${DEMOS_COUCHDB}/couchmark" && \
	    ${QCURL} -X DELETE "${DEMOS_COUCHDB}/couchmark"
	@echo 'Deleting demos admin...'
	@${QCURL} -X DELETE \
	    "${DEMOS_COUCHDB}/_config/admins/demos"

clean: reset
	rm -rf dist tmp
	
