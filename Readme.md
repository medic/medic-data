
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
| PRELOAD_APP_MARKET | Which version of the app to install. Options: diy, release, beta or alpha Default: diy
| PRELOAD_APP_MARKET_URL | What market to use. Default: https://staging.dev.medicmobile.org
| COUCHDB_OWNER      | The owner and group value when installing the dashboard, used with the chown command. Default: couchdb:couchdb
| UPLOAD_DB_URL      | CouchDB database to upload final assets to. Defaults to $DEMOS_COUCHDB/downloads or http://localhost:5984/downloads.

If your environment variables have a hash or dollar sign you will need to
escape them like `\#` or `$$` otherwise make interprets them.

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
