var querystring = require('querystring'),
    http = require('http'),
    url = require('url');

var handlebars = require('handlebars'),
    moment = require('moment'),
    _ = require('underscore'),
    async = require('async');

var data = {
        app_settings: require('../../../generic-anc/app-settings'),
        facilities: require('../../../generic-anc/facilities'),
        messages: require('../../../generic-anc/messages'),
        forms: require('../../../generic-anc/forms')
    },
    db = {};

function updateAppSettings(cb) {
    // temp disable
    //return cb();
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path + '/_design/medic/_rewrite/update_settings/medic?replace=1',
        method: 'PUT'
    };
    if (db.auth) {
        options.auth = db.auth;
    }
    console.log('options', options);
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('chunk', chunk);
            try {
                var ret = JSON.parse(chunk);
            } catch (e) {
                cb('request failed' + ' ' + e);
            }
            // check request body to confirm success
            ret.success ? cb() : cb('request failed');
        });
    });
    req.on('error', cb);
    // include forms separately and modify to expected data
    // structure (object literal).
    data.app_settings.forms = {};
    _.each(data.forms, function(form) {
        data.app_settings.forms[form.meta.code.toUpperCase()] = form;
    });
    req.write(JSON.stringify(data.app_settings));
    req.end();
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
    console.log('options', options);
    var req = http.request(options, function(res) {
        console.log('res.statusCode', res.statusCode);
        console.log('res.headers', res.headers);
        if (res.statusCode == 409) {
            // allowing conflicts
            console.warn('skipping conflict on ' + data._id);
        } else if (res.statusCode != 201) {
            return cb('request failed');
        }
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('chunk2', chunk);
            cb();
        });
    });
    req.on('error', cb);
    req.write(JSON.stringify(data));
    req.end();
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
            // todo
            return;
        }
        body[key] = val;
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

function exitError(err) {
    if (err) {
        console.error("\nExiting: ", err);
        process.exit(1);
    }
};

if (!process.env.DEMOS_COUCHDB) {
    exitError(
        "Please define a DEMOS_COUCHDB in your environment e.g. \n" +
        "export DEMOS_COUCHDB='http://admin:secret@localhost:5984'"
    );
}

db = url.parse(process.env.DEMOS_COUCHDB);

// everything here applies to the medic db.
// todo this should probably be a env var
db.path += 'medic';

console.log('Uploading app settings...');
updateAppSettings(function(err) {
    exitError(err);
    console.log('\nUploading facilities...');
    async.each(data.facilities, createDoc, function(err){
        exitError(err);
        console.log('\nUploading messages...');
        async.each(data.messages, postMessageGroup, function(err){
            //console.log(JSON.stringify(data.messages,null,2));
            exitError(err);
        });
    });
});
