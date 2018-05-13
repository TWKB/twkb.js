module.exports = {
    "extends": "eslint:recommended",
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module'
    },
    "env": {
        "browser": true,
        "node": true,
        "es6": true
    },
    "rules": {
        "no-constant-condition": ["error", { "checkLoops": false }]
    }
};