
var http = require('http'),
    url = require('url');

var logger = require('../lib/logger');

function exitError(err) {
    if (err) {
        logger.error("Exiting: ", err);
        process.exit(1);
    }
};


/*
 * Process http callback instructions, this should also set all "pending"
 * message state values to "sent".
 */
function resolvePending(cb) {
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path + '/_design/medic/_rewrite/add'
    };
    //logger.info('making request', options);
    if (db.auth) {
        options.auth = db.auth;
    }
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        var data = '';
        res.on('data', function (chunk) {
            //logger.info('chunk', chunk);
            data += chunk;
        });
        res.on('end', function() {
            var ret;
            try {
                ret = JSON.parse(data);
            } catch (e) {
                return cb('response parsing failed: ' + e);
            }
            if (res.statusCode != 200) {
                return cb('failed to query pending messages.');
            }
            if (!ret.callback) {
                return cb();
            }
            logger.info('Processing pending queue');
            doHttpCallback(ret.callback, function(err) {
                if (err) {
                    cb(err);
                }
                resolvePending(cb);
            });
        });
    });
    req.on('error', cb);
    req.end();
};

function doHttpCallback(data, cb) {
    var req = http.request({
          host: data.options.host,
          port: data.options.port,
          method: data.options.method,
          path: data.options.path,
          headers: data.options.headers
        }, function(res) {
            if ([200, 201].indexOf(res.statusCode) < 0) {
                cb('error procesing callback: ' + res.statusCode);
            } else {
                cb();
            }
        }
    );
    req.on('error', cb);
    //logger.info(querystring.stringify(body));
    req.write(JSON.stringify(data.data));
    req.end();
};

if (!process.env.DEMOS_COUCHDB) {
    exitError(
        "Please define a DEMOS_COUCHDB in your environment e.g. \n" +
        "export DEMOS_COUCHDB='http://admin:secret@localhost:5984'"
    );
}

var db = url.parse(process.env.DEMOS_COUCHDB),
    data = {};

db.path += 'medic';

resolvePending(function(err) {
    exitError(err);
    logger.info('done.')
    process.exit(0);
});
