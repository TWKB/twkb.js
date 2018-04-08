module.exports = {
    "extends": "eslint:recommended",
    "env": {
        "browser": true,
        "node": true,
        "es6": true
    },
    "rules": {
        "no-constant-condition": ["error", { "checkLoops": false }]
    }
};