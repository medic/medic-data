
QMAKE := ${MAKE} --no-print-directory

all: demos

demos: demos-generic-anc

demos-generic-anc: 
	@echo 'Building demos-generic-anc... ' && \
	(cd demos/generic-anc && ${QMAKE}) && \
	echo 'done.'
