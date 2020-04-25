"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("debug");
class Policy {
    whitelist(fields, body) {
        for (const field in body) {
            if (field !== 'id' && !fields.includes(field)) {
                debug_1.default('asr:policy')(`BodyEdit<T>.${field} has not been whitelisted for that profile`);
                return false;
            }
        }
        return true;
    }
}
exports.default = Policy;
