/*
 *
 * Combine forms with app settings data and update design doc through Medic
 * Mobile API replacing any existing settings.
 *
 * On success exit 0, otherwise exit 1 with error message.
 *
 */

var querystring = require('querystring'),
    _ = require('underscore'),
    http = require('http'),
    path = require('path'),
    url = require('url');

var logger = require('../lib/logger');

function exitError(err) {
    if (err) {
        logger.error("\nExiting: ", err);
        process.exit(1);
    }
};

function updateAppSettings(cb) {
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path + '/_design/medic/_rewrite/update_settings/medic?replace=1',
        method: 'PUT'
    };
    if (db.auth) {
        options.auth = db.auth;
    }
    //logger.info('options', options);
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            //logger.info('chunk', chunk);
            try {
                var ret = JSON.parse(chunk);
            } catch (e) {
                cb('request failed' + ' ' + e);
            }
            // check request body to confirm success
            ret.success ? cb() : cb('request failed: ' + chunk);
        });
    });
    req.on('error', cb);
    // modify forms to expected data structure (object literal).
    data.app_settings.forms = {};
    _.each(data.forms, function(form) {
        data.app_settings.forms[form.meta.code.toUpperCase()] = form;
    });
    req.write(JSON.stringify(data.app_settings));
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

// Support command line arguments for paths to JSON source file.
data.app_settings = process.argv[2] ?
    require(process.cwd() + path.sep + process.argv[2]) :
    require(['..','..','..','generic-anc','diy','app-settings'].join(path.sep));

data.forms = process.argv[3] ?
    require(process.cwd() + path.sep + process.argv[3]) :
    require(['..','..','..','generic-anc','diy','forms'].join(path.sep));

logger.info('Uploading app settings...');
updateAppSettings(function(err) {
    exitError(err);
    logger.info('done.')
});

