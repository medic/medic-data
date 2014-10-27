
QMAKE := ${MAKE} --no-print-directory

all: install build

install:
	npm install && \
	(mkdir tmp && cd tmp && git clone --recursive --depth=25 https://github.com/medic/medic-webapp) && \
	(cd tmp/medic-webapp && npm install && grunt dev) && \
	(mkdir tmp/gardener && cd tmp/gardener && gardener http://localhost:5984/medic &>/dev/null)

build:
	./scripts/run_build.sh

upload:
	./scripts/upload.sh

clean:
	rm -rf dist node_modules tmp
