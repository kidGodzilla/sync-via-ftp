const Client = require('ftp');
const md5 = require('md5');
const fs = require('fs');
let debug = 0;

/**
 * Sync via FTP for simple, lightweight persistence for tiny apps
 * Syncs a global value bi-directionally to a local .json file.
 * Optionally syncs to an FTP server if FTP information is available in process.env
 */
module.exports = function syncViaFtp (namespace, config, cb) {
    if (typeof global[namespace] !== 'object') global[namespace] = {};
    if (!global._lastSyncValues) global._lastSyncValues = {};
    const { FTP_HOST, FTP_USER, FTP_PASS } = process.env;
    let { interval, localPath, remotePath } = config || { interval: 20, localPath: '', remotePath: '' };

    // Shorthand to connect to OUR ftp client
    function connectToFtp () {
        let ftpClient = new Client();

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
        let ftpClient = connectToFtp();

        ftpClient.on('ready', function() {
            ftpClient.get(`${ remotePath }${ namespace }.json`, function(err, stream) {
                if (err) return console.log(err);

                if (debug) console.log(`Writing ${ namespace }.json`);
                stream.pipe(fs.createWriteStream(`./${ localPath }${ namespace }.json`));

                stream.once('close', function () {
                    setTimeout(() => { bootstrap(namespace, cb) }, 400);
                    ftpClient.end();
                });
            });
        });
    }

    // Bootstrap from local file to object
    function bootstrap (namespace, cb) {
        if (debug) console.log('Bootstrapping local files');
        let obj = global[namespace];

        try {
            let obj_string = fs.readFileSync(`./${ localPath }${ namespace }.json`).toString();
            try { obj_string = JSON.parse(obj_string) } catch(e){}
            global[namespace] = Object.assign(obj, obj_string);
        } catch(e){}

        // Failsafe
        if (typeof global[namespace] !== 'object') global[namespace] = {};

        // Callback
        if (cb && typeof cb === 'function') cb(namespace);
    }

    // Persist in-memory data to json file & sync via FTP
    function persist (namespace) {
        if (debug) console.log('Persisting files locally');

        let json_string = JSON.stringify(global[namespace], null, 2);
        let hash = json_string ? md5(json_string) : '';

        if (hash === global._lastSyncValues[namespace]) return;
        global._lastSyncValues[namespace] = hash;

        fs.writeFileSync(`./${ localPath }${ namespace }.json`, json_string, 'utf-8');

        let ftpClient = connectToFtp();

        ftpClient.on('ready', function() {
            if (debug) console.log(`Uploading ${ namespace }.json`);

            ftpClient.put(`${ remotePath }${ namespace }.json`, `${ namespace }.json`, function (err) {
                if (err) return console.log(err);
                ftpClient.end();
            });
        });
    }

    // Set up persistence for our object
    setInterval(function () {
        persist(namespace);
    }, interval * 1000);
    bootstrapFromFtp(namespace, cb);
    bootstrap(namespace, cb);

    return global[namespace];
}
