'use strict';

module.exports = handler => async (req, res, next) => {
    try {
        await handler(req, res, next);
    } catch (err) {
        console.error(err);
        next(err);
    }
};
