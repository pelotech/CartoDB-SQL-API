// This is the file that has the generic configuration and you can override the chnages
// in different environments with env. vars

// Time in milliseconds to force GC cycle.
// Disable by using <=0 value.
module.exports.gc_interval = 10000;
module.exports.routes = {
  // Each entry corresponds with an express' router.
  // You must define at least one path. However, middlewares are optional.
  api: [{
    // Required: path where other "routers" or "controllers" will be attached to.
    paths: [
      // In case the path has a :user param the username will be the one specified in the URL,
      // otherwise it will fallback to extract the username from the host header.
      '/api/:version',
      '/user/:user/api/:version',
    ],
    // Optional: attach middlewares at the begining of the router
    // to perform custom operations.
    // This must be a **comma-separated string** with the list of paths to the middlewares. Pe:
    //     CARTO_SQL_PREROUTING_MIDDLEWARES=/usr/src/lib/mw1.js,/usr/src/lib/mw2.js
    // Note: The list order is kept when loading the middlewares!
    middlewares: process.env.CARTO_SQL_PREROUTING_MIDDLEWARES || '',
    sql: [{
      // Required
      paths: [
        '/sql'
      ],
      // Optional
      middlewares: process.env.CARTO_SQL_SQLROUTING_MIDDLEWARES || ''
    }]
  }]
};
// If useProfiler is true every response will be served with an
// X-SQLAPI-Profile header containing elapsed timing for various
// steps taken for producing the response.
module.exports.useProfiler = true;
// Regular expression pattern to extract username
// from hostname. Must have a single grabbing block.
// for dev-env you need to use  '^(.*)\\.localhost';
module.exports.user_from_host = process.env.CARTO_SQL_API_USER_FROM_HOST || '^(.*)\\.cartodb\\.com$';
module.exports.node_port = 8080;
module.exports.node_host = null; // null on purpouse so it listens to whatever address docker assigns
// idle socket timeout, in miliseconds
module.exports.node_socket_timeout    = 600000;
module.exports.environment = process.env.CARTO_SQL_API_NODE_ENV || 'development';
// Supported labels: 'user_id' (read from redis)
module.exports.db_base_name = process.env.CARTO_SQL_API_DB_BASE_NAME || 'cartodb_user_<%= user_id %>_db';
// Supported labels: 'user_id' (read from redis)
module.exports.db_user      = process.env.CARTO_SQL_API_DB_USER || 'cartodb_user_<%= user_id %>';
// Supported labels: 'user_id', 'user_password' (both read from redis)
module.exports.db_user_pass = '<%= user_password %>';
// Name of the anonymous PostgreSQL user
module.exports.db_pubuser   = 'publicuser';
// Password for the anonymous PostgreSQL user
module.exports.db_pubuser_pass   = 'public';
module.exports.db_host      = process.env.CARTO_SQL_API_POSTGRES_HOST || 'localhost';
module.exports.db_port      = process.env.CARTO_SQL_API_POSTGRES_PORT || '6432';
module.exports.db_batch_port      = process.env.CARTO_SQL_API_POSTGRES_BATCH_PORT || '5432';
module.exports.finished_jobs_ttl_in_seconds = 2 * 3600; // 2 hours
module.exports.batch_query_timeout = 12 * 3600 * 1000; // 12 hours in milliseconds
module.exports.copy_timeout = "'5h'";
module.exports.copy_from_max_post_size = 2 * 1024 * 1024 * 1024; // 2 GB;
module.exports.copy_from_max_post_size_pretty = '2 GB';
module.exports.copy_from_minimum_input_speed = 0; // 1 byte per second
module.exports.copy_from_maximum_slow_input_speed_interval = 15; // 15 seconds
// Max number of queued jobs a user can have at a given time
module.exports.batch_max_queued_jobs = 64;
// Capacity strategy to use.
// It allows to tune how many queries run at a db host at the same time.
// Options: 'fixed', 'http-simple', 'http-load'
module.exports.batch_capacity_strategy = 'fixed';
// Applies when strategy='fixed'.
// Number of simultaneous users running queries in the same host.
// It will use 1 as min.
// Default 4.
module.exports.batch_capacity_fixed_amount = 4;
// Applies when strategy='http-simple' or strategy='http-load'.
// HTTP endpoint to check db host load.
// Helps to decide the number of simultaneous users running queries in that host.
// 'http-simple' will use 'available_cores' to decide the number.
// 'http-load' will use 'cores' and 'relative_load' to decide the number.
// It will use 1 as min.
// If no template is provided it will default to 'fixed' strategy.
module.exports.batch_capacity_http_url_template = 'http://<%= dbhost %>:9999/load';
// Max database connections in the pool
// Subsequent connections will wait for a free slot.i
// NOTE: not used by OGR-mediated accesses
module.exports.db_pool_size = 500;
// Milliseconds before a connection is removed from pool
module.exports.db_pool_idleTimeout = 30000;
// Milliseconds between idle client checking
module.exports.db_pool_reapInterval = 1000;
// max number of bytes for a row, when exceeded the query will throw an error
// module.exports.db_max_row_size = 10 * 1024 * 1024;
// allows to use an object to connect with node-postgres instead of a connection string
module.exports.db_use_config_object = true;
// requires enabling db_use_config_object=true
// allows to enable/disable keep alive for database connections
// by default is not enabled
module.exports.db_keep_alive = {
    enabled: true,
    initialDelay: 5000 // Not used yet
};
module.exports.redis_host   = process.env.CARTO_SQL_API_REDIS_HOST || '127.0.0.1';
module.exports.redis_port   = process.env.CARTO_SQL_API_REDIS_PORT || 6379;
module.exports.redisPool    = 50;
module.exports.redisIdleTimeoutMillis   = 10000;
module.exports.redisReapIntervalMillis  = 1000;
module.exports.redisLog     = false;

// Temporary directory, make sure it is writable by server user
module.exports.tmpDir = '/tmp';
// change ogr2ogr command or path
module.exports.ogr2ogrCommand = 'ogr2ogr';
// change zip command or path
module.exports.zipCommand = 'zip';
// Optional statsd support
module.exports.statsd = {
    host: 'localhost',
    port: 8125,
    prefix: 'dev.:host.',
    cacheDns: true
    // support all allowed node-statsd options
};
module.exports.health = {
    enabled: true,
    username: 'development',
    query: 'select 1'
};

let allowedHosts = ['carto.com', 'cartodb.com'];
if (process.env.CARTO_SQL_API_OAUTH_HOSTS) {
    const hosts = process.env.CARTO_SQL_API_OAUTH_HOSTS.split(',');
    if (hosts.length > 0) {
        allowedHosts = hosts;
    }
}
module.exports.oauth = {

    allowedHosts: allowedHosts
};
module.exports.disabled_file = 'pids/disabled';

module.exports.ratelimits = {
    // whether it should rate limit endpoints (global configuration)
    rateLimitsEnabled: false,
    // whether it should rate limit one or more endpoints (only if rateLimitsEnabled = true)
    endpoints: {
        query: false,
        job_create: false,
        job_get: false,
        job_delete: false,
        copy_from: false,
        copy_to: false
    }
};

module.exports.validatePGEntitiesAccess = false;
module.exports.logQueries = true;
module.exports.maxQueriesLogLength = 1024;

module.exports.cache = {
    ttl: 60 * 60 * 24 * 365, // one year in seconds
    fallbackTtl: 60 * 5 // five minutes in seconds
};

module.exports.pubSubMetrics = {
    enabled: process.env.CARTO_SQL_API_METRICS_ENABLED === 'true' || false,
    project_id: process.env.CARTO_SQL_API_METRICS_PROJECT_ID || 'avid-wavelet-844',
    credentials: '',
    topic: process.env.CARTO_SQL_API_METRICS_PROJECT_ID || 'raw-metric-events'
};

// override some defaults for tests
if (process.env.NODE_ENV === 'test') {
    module.exports.redisIdleTimeoutMillis = 1;
    module.exports.redisReapIntervalMillis = 1;
    module.exports.db_pubuser = 'testpublicuser';
    module.exports.batch_query_timeout = 5 * 1000; // 5 seconds in milliseconds
    module.exports.redisIdleTimeoutMillis = 1;
    module.exports.redisReapIntervalMillis = 1;
    module.exports.db_base_name = 'cartodb_test_user_<%= user_id %>_db';
    module.exports.db_user = 'test_cartodb_user_<%= user_id %>';
    module.exports.db_user_pass = 'test_cartodb_user_<%= user_id %>_pass';
    module.exports.user_from_host = '^([^.]*)\\.';
    module.exports.oauth = {
        allowedHosts: ['localhost.lan:8080', 'localhostdb.lan:8080']
    };
    module.exports.health = {
        enabled: true,
        username: 'vizzuality',
        query: 'select 1'
    };
}
