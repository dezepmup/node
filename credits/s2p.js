if (path == 'hpp/deposit' || path == 'hpp/withdrawal') {
    var parsed = JSON.parse(pm.request.body.raw);
    if (parsed.signature) {
        delete parsed.signature;
    }

    const ordered = sortRecursive(parsed);
    const jsonData = JSON.stringify(ordered).replace(/\//g, '\\/');
    const signature = CryptoJS.SHA256(jsonData + pm.collectionVariables.get("salt"));
    pm.collectionVariables.set("signature", signature.toString());
}

function sortRecursive(object) {
    if (typeof object != "object") {
        return object;
    }
    if (object instanceof Array) {
        return object.map(sortRecursive);
        // return object;
    }

    return Object.keys(object).sort().reduce(
        (result, key) => {
            result[key] = sortRecursive(object[key]);
            return result;
        },
        {}
    );
}


app.use(function (req, res, next) {
    var user = auth(req);

    if (user === undefined || user['name'] !== 'username' || user['pass'] !== 'password') {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="MyRealmName"');
        res.end('Unauthorized');
    } else {
        next();
    }
});



export const sortKeys = x => {
    if (typeof x !== 'object' || !x) return x;
    if (Array.isArray(x)) return x.map(sortKeys);
    return Object.keys(x)
        .sort()
        .reduce((o, k) => ({ ...o, [k]: sortKeys(x[k]) }), {});
}