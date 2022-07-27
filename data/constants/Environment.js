class Environment {

    static getEnvironments() {
        const globalEnv = process.env;

        let env = {};

        env.serverUrl = globalEnv.FRONT_URL || 'http://localhost:3037/';
        env.port = globalEnv.LISTEN || 3037;

        env.steamConfiguration = {
            username: "",
            password: "",
            sharedSecret: "",
            apiKey: "",
            identitySecret: "",
            secretString: "",
            botSteamId: ""
        };

        env.dbMasterDsn = globalEnv.MONGO_MASTER_DSN || 'mongodb://admin:admin@127.0.0.1:27017/mydatabase?authSource=admin';

        const dbUrl = new URL(env.dbMasterDsn);
        env.db = {
            host: dbUrl.host,
            username: dbUrl.username,
            password: dbUrl.password,
            database: dbUrl.pathname.replace('/', ''),
        };

        return env;
    }
}

module.exports = Environment;
