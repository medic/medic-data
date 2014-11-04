/*
 *
 * Wait for db update sequence to stop increasing.  Polls for sentinel
 * processing completion.
 *
 * On success exit 0, otherwise exit 1 with error message.
 *
 */
var http = require('http'),
    url = require('url');

function exitError(err) {
    if (err) {
        console.error("\nExiting: ", err);
        process.exit(1);
    }
};

var max_tries = 500,
    retry_count = 0,
    wait_secs = 30,
    update_seq;

function pollUpdateSeq(cb) {
    //console.log('Polling for update_seq on ' + db.path);
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path
    };
    if (db.auth) {
        options.auth = db.auth;
    }
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            try {
                var ret = JSON.parse(chunk);
            } catch (e) {
                return cb('request failed ' + e);
            }
            if (ret.update_seq == update_seq) {
                console.log("done, update_seq is " + ret.update_seq);
                return cb();
            } else if (retry_count < max_tries) {
                console.log("retrying, update_seq is " + ret.update_seq);
                retry_count++;
                update_seq = ret.update_seq;
                setTimeout(function() {
                    pollUpdateSeq(cb);
                }, wait_secs * 1000);
            } else {
                return cb('Timeout waiting for update_seq to stop increasing.');
            }
        });
    });
    req.on('error', cb);
    req.end();
};

if (!process.env.DEMOS_COUCHDB) {
    exitError(
        "Please define a DEMOS_COUCHDB in your environment e.g. \n" +
        "export DEMOS_COUCHDB='http://admin:secret@localhost:5984'"
    );
}

var db = url.parse(process.env.DEMOS_COUCHDB);

// todo this should probably be a env var
db.path += process.argv[2] || 'couchmark';

pollUpdateSeq(function(err) {
    exitError(err);
});

console.log('\nWaiting for sentinel to finish processing...');
