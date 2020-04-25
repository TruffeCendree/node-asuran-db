"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const t = require("io-ts");
exports.RegexType = new t.Type('RegexType', (input) => typeof input === 'string', (input, context) => {
    if (typeof input !== 'string')
        return t.failure(input, context);
    try {
        new RegExp(input); // tslint:disable-line
        return t.success(input);
    }
    catch (err) {
        return t.failure(input, context);
    }
}, a => a);
