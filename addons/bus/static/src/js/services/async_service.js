odoo.define('bus.AsyncJobService', function (require) {
"use strict";

const AbstractService = require('web.AbstractService');
const { serviceRegistry, bus, _lt, _t } = require('web.core');
const session = require('web.session');

/**
 * @typedef jobstate
 * @enum {string}
 */
const CREATED = 'created';        // the task has been enqueued for later processing
const PROCESSING = 'processing';  // a worker begins to process the task
const SUCCEEDED = 'succeeded';    // the task succeeded with a result the user must process
const DONE = 'done';              // the task succeeded without result or the user processed it
const FAILED = 'failed';          // the task failed with an error


const TASK_CREATED_TITLE = _lt("Background task created");
const TASK_CREATED_CONTENT = _lt("The task %s has been scheduled for processing and will start shortly.");
const TASK_DONE_TITLE = _lt("Background task completed");
const TASK_SUCCEEDED_CONTENT = _lt("The task %s is ready, you can resume its execution via the task list.");
const TASK_FAILED_CONTENT = _lt("The task %s failed, you can show the error via the task list.");
const TASK_DONE_CONTENT = _lt("The task %s has been completed by the server.");

/**
 * Async service help, watch the longpolling bus for notifications sent
 * by ir.async upon job creation, processing and termination. Keep an
 * internal database of all known jobs plus send events on the ``async_job``
 * core bus.
 */
const AsyncJobService = AbstractService.extend({
    dependencies: ['bus_service', 'ajax', 'crash_manager'],

    /**
     * @override
     */
    init() {
        this._jobs = {};
        return this._super(...arguments);
    },

    /**
     * @override
     */
    start() {
        this._super(...arguments);
        this.call('bus_service', 'onNotification', this, this._onNotification);
        this.dlJobs();
    },


    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {object} job map id -> job
     */
    getJobs() {
        return this._jobs;
    },


    /**
     * Update the internal job list
     */
    dlJobs() {
        this._rpc({
            model: 'ir.async',
            method: 'search_read',
            kwargs: {
                domain: [
                    ['user_id', '=', session.uid],
                    ['notify', '=', 1],
                    ['state', '!=', 'done'],
                ],
                fields: ['id', 'name', 'state', 'payload'],
            }
        }).then(jobs => {
            for (let job of jobs) {
                if (job.payload)
                    job.payload = JSON.parse(job.payload);
                this._jobs[job.id] = job;
            }
        })
    },

    /**
     * @return {object} job map id -> job
     */
    getJobs() {
        return this._jobs;
    },

    /**
     * Execute the action of a SUCCEEDED job or show the error of a FAILED one
     * @param  {integer} jobId
     */
    resume(jobId) {
        const job = this._jobs[jobId];
        if (job.state === SUCCEEDED
            && (job.payload.result["type"] || "").startsWith("ir.action")) {
            this.do_action(job.payload.result).then(() => {
                // Quickly update this tab
                job.state = DONE;
                delete job.payload;
                bus.trigger('async_job', job);

                // Make the server send a message on the bus to notify
                // the other tabs
                this._rpc({
                    model: 'ir.async',
                    method: 'complete',
                    args: [job.id],
                });
            });
        } else if (job.state === FAILED) {
            this.call('crash_manager', 'rpc_error', job.payload.error);
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Shows a notification for newly created jobs and when jobs are done
     * processing.
     *
     * @private
     * @param {Job} new job
     * @param {jobState} oldState
     */
    _notify(job, oldState) {
        if (job.state === CREATED) {
            this.do_notify(TASK_CREATED_TITLE, _.str.sprintf(TASK_CREATED_CONTENT.toString(), job.name));
        }

        if (oldState !== PROCESSING)
            return;

        switch (job.state) {
            case SUCCEEDED:
                this.do_notify(TASK_DONE_TITLE, _.str.sprintf(TASK_SUCCEEDED_CONTENT.toString(), job.name));
                break;
            case FAILED:
                this.do_warn(TASK_DONE_TITLE, _.str.sprintf(TASK_FAILED_CONTENT.toString(), job.name));
                break;
            case DONE:
                this.do_notify(TASK_DONE_TITLE, _.str.sprintf(TASK_DONE_CONTENT.toString(), job.name));
                break;
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Dispatch a core bus event on async job update
     *
     * @private
     * @param {Object[]]} notifications
     * @param {string} notifications[i].type
     * @param {integer} notifications[i].id
     * @param {string} notifications[i].name
     * @param {jobstate} notifications[i].state
     * @param {Object} [notifications[i].payload]
     */
    _onNotification(notifications) {
        for (const notif of notifications) {
            if (notif[1].type !== 'ir.async')
                continue

            /**
             * @typedef Job
             * @type {object}
             * @property {number} id - record id
             * @property {string} name - description
             * @property {jobstate} state - current processing state
             * @property {?Object} payload - optionnal payload for succeeded and failed jobs
             */
            const job = {
                id: notif[1].id,
                name: notif[1].name,
                state: notif[1].state,
                payload: notif[1].payload,
            }

            // Discard jobs that are in a previous stage
            const order = [CREATED, PROCESSING, SUCCEEDED, FAILED, DONE];
            const oldJob = this._jobs[job.id] || {};
            if (order.indexOf(job.state) < order.indexOf(oldJob.state))
                continue;

            this._notify(job, oldJob.state)

            this._jobs[job.id] = job;
            bus.trigger('async_job', job);
        }
    },
});

serviceRegistry.add('async_job', AsyncJobService);
return {
    'AsyncJobService': AsyncJobService,
    'asyncJobState': {CREATED, PROCESSING, SUCCEEDED, FAILED, DONE}
};

});
