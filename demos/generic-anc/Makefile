
QMAKE := ${MAKE} --no-print-directory

all: install build

install:
	npm install && \
	git clone --recursive --depth=25 https://github.com/medic/medic-webapp && \
	(cd medic-webapp && npm install) && \
	(cd medic-webapp && grunt dev)

build:
	./scripts/run_build.sh

upload:
	./scripts/upload.sh

clean:
	rm -rf dist medic-webapp node_modules
