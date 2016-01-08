'use strict';

var JobBackend = require('./job_backend');
var PSQL = require('cartodb-psql');
var QUERY_CANCELED = '57014';

function JobRunner(metadataBackend, userDatabaseMetadataService, jobPublisher, jobQueue, userIndexer) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.jobPublisher = jobPublisher;
    this.jobQueue =  jobQueue;
    this.userIndexer = userIndexer;
}

JobRunner.prototype.run = function (job_id) {
    var self = this;

    var jobBackend = new JobBackend(this.metadataBackend, this.jobQueue, this.jobPublisher, this.userIndexer);

    jobBackend.get(job_id, function (err, job) {
        if (err) {
            return jobBackend.emit('error', err);
        }

        if (job.status !== 'pending') {
            return jobBackend.emit('error',
                new Error('Cannot run job ' + job.job_id + ' due to its status is ' + job.status));
        }

        self.userDatabaseMetadataService.getUserMetadata(job.user, function (err, userDatabaseMetadata) {
            if (err) {
                return jobBackend.emit('error', err);
            }

            var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

            jobBackend.setRunning(job);

            pg.query('SET statement_timeout=0', function(err) {
                if(err) {
                    return jobBackend.setFailed(job, err);
                }

                // mark query to allow to users cancel their queries whether users request for it
                var sql = job.query + ' /* ' + job.job_id + ' */';

                pg.eventedQuery(sql, function (err, query /* , queryCanceller */) {
                    if (err) {
                        return jobBackend.setFailed(job, err);
                    }

                    query.on('error', function (err) {
                        if (err.code === QUERY_CANCELED) {
                            return jobBackend.setCancelled(job);
                        }

                        jobBackend.setFailed(job, err);
                    });

                    query.on('end', function (result) {
                        if (result) {
                            jobBackend.setDone(job);
                        }
                    });
                });
            });
        });
    });

    return jobBackend;
};


module.exports = JobRunner;
