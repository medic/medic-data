
# Install

```
npm install gardener -g
npm install garden-core -g
git clone <me>
npm install
```

# Environment Variables

The following evironment variables are supported:

| Variable           | Decription
| ------------------ | ------------- 
| DEMOS_COUCHDB      | The CouchDB URL to use, e.g. http://admin:pass@127.0.0.1:5984
| PRELOAD_APP_DATA   | The type of data set to install. Options: diy, demos Default: diy
| PRELOAD_APP_MARKET | Which version of the app to install. Options: release, beta or alpha Default: release
| COUCHDB_OWNER      | The owner and group value when installing the dashboard, used with the chown command. Default: couchdb:couchdb

# Examples

## Run


Load diy data against beta market app:

```
make
```

Load demos data against beta market app:

```
PRELOAD_APP_DATA=demos make
```

Load demos data against alpha market app:

```
PRELOAD_APP_MARKET=alpha PRELOAD_APP_DATA=demos make
```

Specify CouchDB owner and group:

```
COUCHDB_OWNER=bob:staff make
```

## Reset

```
make clean
```

or

```
DEMOS_COUCHDB=http://demos:secret@localhost:5984 make clean
```
