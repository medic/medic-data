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

var logger = require('../lib/logger');

function exitError(err) {
    if (err) {
        logger.error("Exiting: ", err);
        process.exit(1);
    }
};


/*
 * Poll for record completion, like patient id.
 */
var max_tries = 400,
    wait_secs = .5;
function pollForPID(msg, cb) {
    var uuid = msg.meta && msg.meta.uuid;
    if (!uuid) {
        return cb('uuid missing on message.');
    }
    logger.info('Polling for patient_id on ' + uuid);
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
            //logger.info(chunk);
            data += chunk;
        });
        res.on('end', function() {
            try {
                var ret = JSON.parse(data);
            } catch (e) {
                return cb('request failed ' + e);
            }
            if (ret.patient_id) {
                //logger.info('got patient id ' + ret.patient_id + ' for ' + uuid);
                return cb(null, ret.patient_id);
            } else if (msg.meta.retry_count < max_tries) {
                //logger.info('msg.meta.retry_count', msg.meta.retry_count);
                msg.meta.retry_count++;
                logger.info('Failed to get PID: ' + data);
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
                return cb('request failed ' + e);
            }
            if (ret.uuids) {
                return cb(null, ret.uuids);
            }
            return cb('failed to get UUIDs.');
        });
    });

    req.on('error', cb);
    //logger.info(querystring.stringify(body));
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
    //logger.info('options', options);
    var req = http.request(options, function(res) {
        //logger.info('res.statusCode', res.statusCode);
        //logger.info('res.headers', res.headers);
        if (res.statusCode == 409) {
            // allowing conflicts
            logger.warn('skipping conflict on ' + data._id);
        } else if (res.statusCode != 201) {
            return cb('request failed');
        }
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            //logger.info('created doc', chunk);
            cb();
        });
    });
    req.on('error', cb);
    req.write(JSON.stringify(data));
    req.end();
};

function getContactByView(phone, ddoc, view, cb) {
    if (!phone) {
      return cb('Missing phone parameter.');
    }
    var options = {
        hostname: db.hostname,
        port: db.port,
        path: db.path +
            '/_design/' + ddoc + '/_view/' + view + '?' +
            querystring.stringify({
                include_docs: true,
                startkey: JSON.stringify([phone]),
                endkey: JSON.stringify([phone, {}])
            })
    };
    if (db.auth) {
        options.auth = db.auth;
    }
    //logger.info('options', options);
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
                return cb('request failed: ' + e);
            }
            if (res.statusCode != 200) {
                return cb('failed to create message: ' + JSON.stringify(ret));
            }
            cb(null, ret.rows.length && ret.rows[0].doc)
        });
    });
    req.on('error', cb);
    req.end();
};

function getContact(phone, cb) {
    getContactByView(phone, 'medic-client', 'person_by_phone', function(err, contact) {
        if (err) {
            // person_by_phone only exists in recent branches so
            // try the outdated facility_by_phone
            getContactByView(phone, 'medic', 'facility_by_phone', function(err, facility) {
                cb(err, undefined, facility);
            });
        } else {
            cb(err, contact);
        }
    });
};

function createOutgoingMessage(msg, cb) {
    getUUIDs(function(err, uuids) {
        if (err) {
            return cb(err);
        }
        var sent_by = msg.meta.sent_by || 'admin',
            reported_date = Date.create(msg.sent_timestamp);
        getContact(msg.to, function(err, contact, facility) {
            //logger.info('msg.to', msg.to);
            //logger.info('contact', contact);
            if (err) {
                return cb(err);
            }
            createDoc({
                _id: uuids[0],
                kujua_message: true,
                type: 'data_record',
                sent_by: sent_by,
                reported_date: reported_date.valueOf(),
                read: [],
                form: null,
                errors: [
                ],
                tasks: [{
                    messages: [
                        {
                            sent_by: sent_by,
                            to: msg.to,
                            contact: contact,
                            facility: facility,
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
    //logger.info('postMessage db.auth', db.auth);
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
            //logger.info('chunk', chunk);
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
            if (!msg.meta) {
              msg.meta = {};
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
    //logger.info(querystring.stringify(body));
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


/*
 * Post each message group in series.  Each group needs to be posted in series
 * since one message might be dependent on another, e.g. a pregnancy
 * registration and visit.  It also simulates how messages are throttled via
 * the telecom network, in production multiple messages are never received all
 * at once.  Transitions are also designed to work this way since they can
 * modify other records besides the changed record/doc.
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
logger.info('Uploading messages...');
async.eachSeries(data.messages, postMessageGroup, function(err){
    //logger.info(JSON.stringify(data.messages,null,2));
    exitError(err);
    logger.info('done.')
});
