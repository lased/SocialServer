const socketioJwt = require('socketio-jwt');

const User = require('../models/user');

const log = require('../lib/log')(module);
const config = require('../config');
const http = require('../http');

module.exports = function (h) {
    const io = require('socket.io')(h);

    io.use(socketioJwt.authorize({
        secret: config.get('secret'),
        handshake: true
    }));

    io.on('connection', (socket) => {
        let data = socket.decoded_token;
        data.platform = socket.platform = socket.handshake.query.mobile == 'true' ? true : false;

        log.info('Socket connect');

        socket.join('user ' + data.id, () => online(data));

        socket.on('disconnect', () => offline(data));
    });

    return io;
}

// async.waterfall([
//     function (callback) {
//         User.findOne({ url }, function(err, user){
//             if(err) return callback(err);

//             return callback(null, user);
//         });
//     },
//     function (user, callback) {
//         res.json(user);
//         callback(null);
//     }
// ], function (err, result) {
//     if (err) return res.json(http(500));        
// });


function online(data) {
    User.findByIdAndUpdate(data._id, { platform: data.platform, state: true }).exec();
}
function offline(data) {
    User.findByIdAndUpdate(data._id, { lastAccess: Date.now(), state: false }).exec();
    log.info('Socket disconnect');
}
