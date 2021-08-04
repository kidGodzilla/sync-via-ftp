const writeJsonFile = require('write-json-file');
const loadJsonFile = require('load-json-file');
const Client = require('ftp');
const md5 = require('md5');
const fs = require('fs');
let destroy = null;
// let debug = 0;

/**
 * Sync via FTP for simple, lightweight persistence for tiny apps
 * Syncs a global value bi-directionally to a local .json file.
 * Optionally syncs to an FTP server if FTP information is available in process.env
 */
module.exports = function syncViaFtp (namespace, config, cb) {
    let defaults = { interval: 20, localPath: './', remotePath: '', type: 'json', debug: false, ready: () => {} };
    let { interval, localPath, remotePath, type, ready, debug } = Object.assign(defaults, (config || defaults));
    if (typeof global[namespace] !== 'object') global[namespace] = {};
    if (!global._lastSyncValues) global._lastSyncValues = {};
    const { FTP_HOST, FTP_USER, FTP_PASS } = process.env;

    // Shorthand to connect to OUR ftp client
    function connectToFtp () {
        let ftpClient = new Client();
        destroy = ftpClient.destroy;

        if (FTP_HOST && FTP_USER && FTP_PASS) {
            ftpClient.connect({
                host: FTP_HOST,
                user: FTP_USER,
                password: FTP_PASS
            });
        }

        return ftpClient;
    }

    // Get remote file via FTP, save as local file, & bootstrap to object
    function bootstrapFromFtp (namespace, cb) {
        if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
            if (cb && typeof cb === 'function') cb();
            return;
        }

        let ftpClient = connectToFtp();

        ftpClient.on('ready', function() {
            ftpClient.get(`${ remotePath }${ namespace }${ type === 'json' ? '.json' : '' }`, function(err, stream) {
                if (err) return console.log(err);

                if (debug) console.log(`Writing ${ namespace }${ type === 'json' ? '.json' : '' }`);
                stream.pipe(fs.createWriteStream(`${ localPath }${ namespace }${ type === 'json' ? '.json' : '' }`));

                stream.once('close', function () {
                    setTimeout(() => {
                        bootstrap(namespace, cb);
                    }, 400);

                    ftpClient.end();
                });
            });
        });
    }

    // Bootstrap from local file to object
    async function bootstrap (namespace, cb) {
        if (type !== 'json') {
            if (cb && typeof cb === 'function') cb();
            ready();
            return;
        }

        if (debug) console.log('Bootstrapping local files');
        let obj = global[namespace];

        try {
            let obj_string = null;

            obj_string = await loadJsonFile(`${ localPath }${ namespace }${ type === 'json' ? '.json' : '' }`);
            // try { obj_string = fs.readFileSync(`${ localPath }${ namespace }${ type === 'json' ? '.json' : '' }`).toString() } catch(e){}
            // try { obj_string = JSON.parse(obj_string) } catch(e){}
            if (typeof obj_string !== 'object') obj_string = {};
            if (typeof obj !== 'object') obj = {};

            global[namespace] = Object.assign(obj || {}, obj_string || {});
        } catch(e){}

        // Failsafe
        if (typeof global[namespace] !== 'object') global[namespace] = {};

        // Callback
        if (cb && typeof cb === 'function') cb(namespace);
        ready();
    }

    // Persist in-memory data to json file & sync via FTP
    function persist (namespace, cb) {
        if (type === 'json') {
            if (debug) console.log('Persisting files locally');

            if (typeof global[namespace] !== 'object') global[namespace] = {};

            let json_string = JSON.stringify(global[namespace], null, 2);
            let hash = json_string ? md5(json_string) : '';

            if (hash === global._lastSyncValues[namespace]) return;
            global._lastSyncValues[namespace] = hash;

            writeJsonFile(`${ localPath }${ namespace }${ type === 'json' ? '.json' : '' }`, global[namespace]);
            // fs.writeFileSync(`${ localPath }${ namespace }${ type === 'json' ? '.json' : '' }`, json_string, 'utf-8');
        }

        if (FTP_HOST && FTP_USER && FTP_PASS) {
            if (debug) console.log('Uploading local files via FTP');

            let ftpClient = connectToFtp();

            ftpClient.on('ready', function() {
                if (debug) console.log(`Uploading ${ namespace }${ type === 'json' ? '.json' : '' }`);

                ftpClient.put(`${ localPath }${ namespace }${ type === 'json' ? '.json' : '' }`, `${ remotePath }${ namespace }${ type === 'json' ? '.json' : '' }`, function (err) {
                    if (err) return console.log(err);
                    ftpClient.end();

                    if (cb && typeof cb === 'function') cb();
                });
            });
        }
    }

    // Set up persistence for our object
    setTimeout(() => {
        if (interval) {
            // Fix Interval
            interval = parseInt(interval);
            if (typeof interval !== 'number') interval = 20;

            setInterval(() => {
                persist(namespace);
            }, interval * 1000);

        } else {
            persist(namespace);
        }
    }, 10000);


    bootstrapFromFtp(namespace, cb);
    if (type === 'json') bootstrap(namespace, cb);

    return (type === 'json') ? global[namespace] : {
        persist: function (cb) {
            persist(namespace, cb);
        },
        destroy
    };
}
