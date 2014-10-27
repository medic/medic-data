
QMAKE := ${MAKE} --no-print-directory

all: demos

demos: demos-generic-anc

clean: 
	@echo 'Cleaning demos-generic-anc... ' && \
	(cd demos/generic-anc && ${QMAKE} clean) >/dev/null && \
	echo 'done.'

demos-generic-anc: 
	@echo 'Building demos-generic-anc... ' && \
	(cd demos/generic-anc && ${QMAKE}) && \
	echo 'done.'
