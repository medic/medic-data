/*
 *
 * Add message data using Medic Mobile API.
 *
 * On success exit 0, otherwise exit 1 with error message.
 *
 */
var querystring = require('querystring'),
    http = require('http'),
    path = require('path'),
    url = require('url');

var handlebars = require('handlebars'),
    moment = require('moment'),
    _ = require('underscore'),
    async = require('async'),
    sugar = require('sugar');

function exitError(err) {
    if (err) {
        console.error("\nExiting: ", err);
        process.exit(1);
    }
};


/*
 * Poll for record completion, like patient id.
 */
var max_tries = 50,
    wait_secs = 10;
function pollForPID(msg, cb) {
    var uuid = msg.meta && msg.meta.uuid;
    if (!uuid) {
        return cb('uuid missing on message.');
    }
    console.log('Polling for PID on ' + uuid);
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path + '/' + uuid
    };
    if (db.auth) {
        options.auth = db.auth;
    }
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            //console.log(chunk);
            try {
                var ret = JSON.parse(chunk);
            } catch (e) {
                return cb('request failed ' + e);
            }
            if (ret.patient_id) {
                return cb(null, ret.patient_id);
            } else if (msg.meta.retry_count < max_tries) {
                console.log('msg.meta.retry_count', msg.meta.retry_count);
                msg.meta.retry_count++;
                setTimeout(function() {
                    pollForPID(msg, cb);
                }, wait_secs * 1000);
            } else {
                return cb('failed to get patient id');
            }
        });
    });
    req.on('error', cb);
    req.end();
};

function isValidRegistration(msg) {
    return msg.meta.type === 'registration' && !msg.meta.invalid;
}

/*
 * Update placeholders in messages.
 *
 * Create the template context based on a registration.meta property
 * then only apply that context to messages in the same group.
 *
 */
function renderTemplatesInGroup(uuid) {
    _.each(data.messages, function(group) {
        var context;
        _.each(group, function(msg) {
            if (isValidRegistration(msg) && msg.meta.uuid === uuid) {
                context = msg.meta;
            }
            if (context && msg.message) {
                var t = handlebars.compile(msg.message);
                msg.message = t(context);
            }
        });
    });
};

/*
 * Messages in a group are posted in series. We need to resolve patient id on
 * registrations first and then apply that data to visit messages.
 */
function postMessageGroup(group, cb) {
    async.eachSeries(group, postMessage, cb);
};

function postMessage(msg, cb) {

    console.log((msg.meta && msg.meta.description) || msg.message);

    var body = {};
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path + '/_design/medic/_rewrite/add',
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        }
    };
    console.log('postMessage db.auth', db.auth);
    if (db.auth) {
        options.auth = db.auth;
    }

    // prepare post body
    _.each(msg, function(val, key) {
        if (key === 'meta') {
            return;
        }
        if (key === 'sent_timestamp') {
            body[key] = Date.create(val).valueOf();
        } else {
            body[key] = val;
        }
    });

    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('chunk', chunk);
            var ret, uuid;
            try {
                ret = JSON.parse(chunk);
            } catch (e) {
                return cb('request failed ' + e);
            }
            if (res.statusCode != 200) {
                return cb('failed to create message: ' + JSON.stringify(ret));
            }
            uuid = ret.payload.id;
            if (!uuid) {
                // adding a message should always return a uuid
                return cb('request failed, uuid not returned.');
            }
            msg.meta.uuid = uuid;
            if (isValidRegistration(msg)) {
                msg.meta.retry_count = 0;
                pollForPID(msg, function(err, pid) {
                    msg.meta.patient_id = pid;
                    renderTemplatesInGroup(uuid);
                    cb(err);
                });
            } else {
                cb();
            }
        });
    });

    req.on('error', cb);
    console.log(querystring.stringify(body));
    req.write(querystring.stringify(body));
    req.end();
}

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
data.messages = process.argv[2] ?
    require(process.cwd() + path.sep + process.argv[2]) :
    require(['..','..','..','generic-anc','messages'].join(path.sep));


console.log('\nUploading messages...');
async.each(data.messages, postMessageGroup, function(err){
    //console.log(JSON.stringify(data.messages,null,2));
    exitError(err);
    console.log('done.')
});
