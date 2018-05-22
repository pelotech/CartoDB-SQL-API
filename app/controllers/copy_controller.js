'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const { getFormatFromCopyQuery } = require('../utils/query_info');

const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;


function CopyController(metadataBackend, userDatabaseService, userLimitsService, statsClient) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseService = userDatabaseService;
    this.userLimitsService = userLimitsService;
    this.statsClient = statsClient;
}

CopyController.prototype.route = function (app) {
    const { base_url } = global.settings;

    const copyFromMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyfrom'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            handleCopyFrom(),
            responseCopyFrom(),
            errorMiddleware()
        ];
    };

    const copyToMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyto'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            handleCopyTo(this.statsClient),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/sql/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_FROM));
    app.get(`${base_url}/sql/copyto`, copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
};

function handleCopyTo (statsClient) {
    return function handleCopyToMiddleware (req, res, next) {
        const { sql } = req.query;
        const filename = req.query.filename || 'carto-sql-copyto.dmp';

        if (!sql) {
            throw new Error("Parameter 'sql' is missing");
        }

        // Only accept SQL that starts with 'COPY'
        if (!sql.toUpperCase().startsWith("COPY ")) {
            throw new Error("SQL must start with COPY");
        }

        let metrics = {
            size: 0,
            time: null,
            format: getFormatFromCopyQuery(req.query.sql)
        };

        res.header("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.header("Content-Type", "application/octet-stream");

        try {
            const start_time = Date.now();

            // Open pgsql COPY pipe and stream out to HTTP response
            const pg = new PSQL(res.locals.userDbParams);
            pg.connect(function (err, client) {
                if (err) {
                    return next(err);
                }

                const pgstream = client.query(copyTo(sql));
                pgstream
                    .on('error', next)
                    .on('data', data => metrics.size += data.length)
                    .on('end', () => {
                        metrics.time = (Date.now() - start_time) / 1000;
                        statsClient.set('copyTo', JSON.stringify(metrics));
                    })
                    .pipe(res);
            });
        } catch (err) {
            next(err);
        }
    };
}

function handleCopyFrom () {
    return function handleCopyFromMiddleware (req, res, next) {
        const { sql } = req.query;

        if (!sql) {
            return next(new Error("Parameter 'sql' is missing, must be in URL or first field in POST"));
        }

        // Only accept SQL that starts with 'COPY'
        if (!sql.toUpperCase().startsWith("COPY ")) {
            return next(new Error("SQL must start with COPY"));
        }

        res.locals.copyFromSize = 0;

        try {
            const start_time = Date.now();

            // Connect and run the COPY
            const pg = new PSQL(res.locals.userDbParams);
            pg.connect(function (err, client) {
                if (err) {
                    return next(err);
                }

                let copyFromStream = copyFrom(sql);
                const pgstream = client.query(copyFromStream);
                pgstream.on('error', next);
                pgstream.on('end', function () {
                    const end_time = Date.now();
                    res.body = {
                        time: (end_time - start_time) / 1000,
                        total_rows: copyFromStream.rowCount
                    };

                    return next();
                });

                if (req.get('content-encoding') === 'gzip') {
                    req
                        .pipe(zlib.createGunzip())
                        .on('data', data => res.locals.copyFromSize += data.length)
                        .pipe(pgstream);
                } else {
                    req
                        .on('data', data => res.locals.copyFromSize += data.length)
                        .pipe(pgstream);
                }
            });

        } catch (err) {
            next(err);
        }
    };
}

function responseCopyFrom () {
    return function responseCopyFromMiddleware (req, res, next) {
        if (!res.body || !res.body.total_rows) {
            return next(new Error("No rows copied"));
        }

        if (req.profiler) {
            const copyFromMetrics = {
                size: res.locals.copyFromSize, //bytes
                format: getFormatFromCopyQuery(req.query.sql),
                time: res.body.time, //seconds
                total_rows: res.body.total_rows, 
                gzip: req.get('content-encoding') === 'gzip'
            };

            req.profiler.add({ copyFrom: copyFromMetrics });
            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
        }

        res.send(res.body);
    };
}

module.exports = CopyController;