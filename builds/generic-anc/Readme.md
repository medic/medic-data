
# Install

```
npm install gardener -g
npm install garden-core -g
git clone <me>
```

# Run

Defaults to DIY data.

```
make
```

or

```
PRELOAD_APP_DATA=demos make
```

# Reset

```
make clean && \
make
```

or

```
DEMOS_COUCHDB=http://demos:secret@localhost:5984 make clean && \
make
```
