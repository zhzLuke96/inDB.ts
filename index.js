'use strict';
module.exports = process.env.NODE_ENV === 'production' ?
    require('./dist/index.min.js') :
    require('./dist/index.js');