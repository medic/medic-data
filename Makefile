
QMAKE := ${MAKE} --no-print-directory
DEMOS_COUCHDB ?= http://localhost:5984

all: demos

demos: demos-generic-anc

clean: 
	@echo 'Cleaning demos-generic-anc... ' && \
	(cd builds/generic-anc && ${QMAKE} clean) >/dev/null && \
	echo 'done.'

demos-generic-anc: 
	@echo 'Building demos-generic-anc... ' && \
	(cd builds/generic-anc && ${QMAKE}) && \
	echo 'done.'

test:
	@echo 'Testing demos-generic-anc... ' && \
	(cd builds/generic-anc && ${QMAKE} test) && \
	echo 'done.'

