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
var max_tries = 500,
    wait_secs = 5;
function pollForPID(msg, cb) {
    var uuid = msg.meta && msg.meta.uuid;
    if (!uuid) {
        return cb('uuid missing on message.');
    }
    console.log('Polling for patient id for ' + uuid);
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
        var data = '';
        res.on('data', function (chunk) {
            //console.log(chunk);
            data += chunk;
        });
        res.on('end', function() {
            try {
                var ret = JSON.parse(data);
            } catch (e) {
                return cb('request failed ' + e);
            }
            if (ret.patient_id) {
                //console.log('got patient id ' + ret.patient_id + ' for ' + uuid);
                return cb(null, ret.patient_id);
            } else if (msg.meta.retry_count < max_tries) {
                //console.log('msg.meta.retry_count', msg.meta.retry_count);
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

function getUUIDs(cb) {
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: '/_uuids?count=10'
    };
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        var data = '';
        res.on('data', function (chunk) {
            //console.log('chunk', chunk);
            data += chunk;
        });
        res.on('end', function() {
            var ret;
            try {
                ret = JSON.parse(data);
            } catch (e) {
                return cb('request failed ' + e);
            }
            if (ret.uuids) {
                return cb(null, ret.uuids);
            }
            return cb('failed to get UUIDs.');
        });
    });

    req.on('error', cb);
    //console.log(querystring.stringify(body));
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
    //console.log('options', options);
    var req = http.request(options, function(res) {
        //console.log('res.statusCode', res.statusCode);
        //console.log('res.headers', res.headers);
        if (res.statusCode == 409) {
            // allowing conflicts
            console.warn('skipping conflict on ' + data._id);
        } else if (res.statusCode != 201) {
            return cb('request failed');
        }
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            //console.log('created doc', chunk);
            cb();
        });
    });
    req.on('error', cb);
    req.write(JSON.stringify(data));
    req.end();
};

function getFacility(phone, cb) {
    if (!phone) {
      return cb('Missing phone parameter.');
    }
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path +
            '/_design/medic/_view/facility_by_phone?' +
            querystring.stringify({
                startkey: JSON.stringify([phone]),
                endkey: JSON.stringify([phone, {}])
            })
    };
    if (db.auth) {
        options.auth = db.auth;
    }
    //console.log('options', options);
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function() {
            var ret;
            try {
                ret = JSON.parse(data);
            } catch (e) {
                return cb('request failed ' + e);
            }
            if (res.statusCode != 200) {
                return cb('failed to create message: ' + JSON.stringify(ret));
            }
            cb(null, ret.rows.length && ret.rows[0].value)
        });
    });
    req.on('error', cb);
    req.end();
};

function createOutgoingMessage(msg, cb) {
    getUUIDs(function(err, uuids) {
        if (err) {
            return cb(err);
        }
        var sent_by = msg.meta.sent_by || 'admin',
            reported_date = Date.create(msg.sent_timestamp);
        getFacility(msg.to, function(err, data) {
            //console.log('msg.to', msg.to);
            //console.log('facility data', data);
            if (err) {
                return cb(err);
            }
            createDoc({
                _id: uuids[0],
                kujua_message: true,
                type: 'data_record',
                sent_by: sent_by,
                reported_date: reported_date.valueOf(),
                related_entities: {},
                read: [],
                form: null,
                errors: [
                ],
                tasks: [{
                    messages: [
                        {
                            sent_by: sent_by,
                            to: msg.to,
                            facility: data || {},
                            message: msg.message,
                            uuid: uuids[1]
                        }
                    ],
                    state: 'sent',
                    state_history: [
                      {
                        state: "pending",
                        timestamp: reported_date.toISOString()
                      },
                      {
                        state: "sent",
                        timestamp: moment(reported_date).add(1, 'minute').toISOString()
                      }
                    ]
                }]
            }, cb);
        });
    });
};

/*
 * Messages in a group are posted in series. We need to resolve patient id on
 * registrations first and then apply that data to visit messages.
 */
function postMessageGroup(group, cb) {
    async.eachSeries(group, function(msg, cb) {
        if (msg.meta && msg.meta.type === 'outgoing') {
            createOutgoingMessage(msg, cb);
        } else {
            postMessage(msg, cb);
        }
    }, cb);
};

function postMessage(msg, cb) {

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
    //console.log('postMessage db.auth', db.auth);
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
        var data = '';
        res.on('data', function (chunk) {
            //console.log('chunk', chunk);
            data += chunk;
        });
        res.on('end', function() {
            var ret, uuid;
            try {
                ret = JSON.parse(data);
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
    //console.log(querystring.stringify(body));
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
    require(['..','..','..','generic-anc','diy','messages'].join(path.sep));


console.log('\nUploading messages...');
async.each(data.messages, postMessageGroup, function(err){
    //console.log(JSON.stringify(data.messages,null,2));
    exitError(err);
    console.log('done.')
});
