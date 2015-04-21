/*
 * Enable this transition during data load only so no messages are marked as
 * pending.
 */
module.exports = function(settings) {
    settings.transitions.resolve_pending = {
        load: "./transitions/resolve_pending.js",
        disable: false
    };
};
