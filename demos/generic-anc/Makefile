
QMAKE := ${MAKE} --no-print-directory
DEMOS_COUCHDB = $(shell ./scripts/set_admin.sh)
DEMOS_DB_DIR = $(shell ./scripts/get_db_dir.sh)
DIST_DIR = dist
BETA_MM = http://staging.dev.medicmobile.org/markets-beta/details/medic
BETA_REPORTER = http://staging.dev.medicmobile.org/markets-beta/details/medic-reporter
DASHBOARD = http://staging.dev.medicmobile.org/downloads/dashboard-medic.couch

all: install listen load compact copy upload

install:
	[ -d "${DEMOS_DB_DIR}" ]
	mkdir -p tmp
	@echo 'Installing Garden20 Dashboard...'
	curl --fail -s "${DASHBOARD}" > tmp/dashboard.couch
	mv tmp/dashboard.couch "${DEMOS_DB_DIR}"
	@echo 'Installing Medic Mobile...'
	garden-core "${BETA_MM}" ${DEMOS_COUCHDB}
	@echo 'Installing Medic Mobile Reporter...'
	garden-core "${BETA_REPORTER}" ${DEMOS_COUCHDB}
	@echo 'Set Medic Mobile security to public...'
	curl --fail -X PUT \
	    -H "Content-Type: application/json" \
	    -d '{"admins":{"names":[],"roles":[]},"members":{"names":[],"roles":[]}}' \
	    "${DEMOS_COUCHDB}/medic/_security"
	@echo 'Set Medic Mobile Reporter security to public...'
	curl --fail -X PUT \
	    -H "Content-Type: application/json" \
	    -d '{"admins":{"names":[],"roles":[]},"members":{"names":[],"roles":[]}}' \
	    "${DEMOS_COUCHDB}/medic-reporter/_security"

listen:
	./scripts/run_gardener.sh

load:
	@echo 'Loading demo data...'
	@echo 'Disabling delayed commits so db syncs to disk per request...'
	curl -s --data '"false"' -X PUT \
	    "${DEMOS_COUCHDB}/_config/couchdb/delayed_commits"
	node ./scripts/load.js

upload:
	./scripts/upload.sh

test:
	./scripts/test.sh
	echo "${DEMOS_DB_DIR}"
	echo "${DEMOS_COUCHDB}"

compact:
	@echo 'Compacting dbs...'

copy:
	[ -d "${DEMOS_DB_DIR}" ]
	@echo 'Copying .couch files...'
	mkdir -p "${DIST_DIR}"
	for i in dashboard.couch medic.couch medic-reporter.couch couchmark.couch; do \
	    cp "${DEMOS_DB_DIR}/$$i" "${DIST_DIR}"; \
	done

reset:
	@echo 'Resetting...'
	curl -X DELETE \
	    "${DEMOS_COUCHDB}/dashboard"
	curl -X DELETE \
	    "${DEMOS_COUCHDB}/medic"
	curl -X DELETE \
	    "${DEMOS_COUCHDB}/couchmark"
	curl -X DELETE \
	    "${DEMOS_COUCHDB}/medic-reporter"
	curl -X DELETE \
	    "${DEMOS_COUCHDB}/_config/admins/demos"

clean: reset
	rm -rf dist tmp
	
