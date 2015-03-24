/*
 *
 * Combine forms with app settings data and update design doc through Medic
 * Mobile API replacing any existing settings.
 *
 * On success exit 0, otherwise exit 1 with error message.
 *
 */

var querystring = require('querystring'),
    async = require('async'),
    http = require('http'),
    path = require('path'),
    url = require('url');

var logger = require('../lib/logger');

var skip_conflicts;
process.argv.forEach(function (val, index, array) {
    if (val === '--skip-conflicts') {
        skip_conflicts = true;
    }
});

function exitError(err) {
    if (err) {
        logger.error("Exiting: ", err);
        process.exit(1);
    }
};

function createDoc(data, cb) {
    if (!data._id) {
      return cb('Document data is missing _id property.');
    }
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path + '/' + data._id,
        method: 'PUT',
        headers: {
            'content-type': 'application/json'
        }
    };
    if (db.auth) {
        options.auth = db.auth;
    }
    //logger.info('options', options);
    var req = http.request(options, function(res) {
        //logger.info('res.statusCode', res.statusCode);
        //logger.info('res.headers', res.headers);
        if (res.statusCode == 409 && skip_conflicts) {
            logger.warn('skipping conflict on ' + data._id);
        } else if (res.statusCode != 201) {
            logger.info('created facility %s', data._id);
            return cb('request failed');
        }
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            //logger.info('chunk2', chunk);
            cb();
        });
    });
    req.on('error', cb);
    req.write(JSON.stringify(data));
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

// todo this should probably be a env var
db.path += 'medic';

// Support command line argument for path to JSON source file.
data.facilities = process.argv[2] ?
    require(process.cwd() + path.sep + process.argv[2]) :
    require(['..','..','..','generic-anc','diy','facilities'].join(path.sep));

logger.info('Uploading facilities...');
async.each(data.facilities, createDoc, function(err){
    exitError(err);
    logger.info('done.');
});
