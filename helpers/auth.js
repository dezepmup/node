const BasicAuth = 'BasicAuth';
const SaltAuth = 'SaltAuth';

const KeepAuthOnReload = (system) => {
    const originalAuthorize = system.authActions.authorize;
    system.authActions.authorize = payload => {
        if (payload[BasicAuth]) {
            const { password, username } = payload[BasicAuth].value;
            window.sessionStorage.setItem(BasicAuth, `${username}//${password}`);
            return originalAuthorize(payload);
        }
        if (payload[SaltAuth]) {
            const token = payload[SaltAuth].value;
            window.sessionStorage.setItem(SaltAuth, token);
            return originalAuthorize(payload);
        }
    };

    const originalLogout = system.authActions.logout;
    system.authActions.logout = payload => {
        window.sessionStorage.removeItem(BasicAuth);
        window.sessionStorage.removeItem(SaltAuth);
        return originalLogout(payload);
    };

    const auth = window.sessionStorage.getItem(BasicAuth);
    const salt = window.sessionStorage.getItem(SaltAuth);

    if (auth) {
        const [username, password] = auth.split('//');
        if (username && password) {
            system.preauthorizeBasic(BasicAuth, username, password);
        }
    }
    if (salt) system.preauthorizeApiKey(SaltAuth, salt);
}

export default KeepAuthOnReload;
