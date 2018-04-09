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
        let roomsChats = [];

        data.platform = socket.platform = socket.handshake.query.mobile == 'true' ? true : false;

        log.info('Socket connect');

        socket.join('user ' + data.id, () => online(data));

        socket.on('join chat', (chat) => {
            joinChat(socket, data, chat);
            roomsChats.push(chat);;
        });
        socket.on('leave chat', (chat) => {
            leaveChat(socket, data, chat);
            roomsChats.splice(roomsChats.indexOf(chat), 1);
        });

        socket.on('disconnect', () => {
            offline(data);
            //При отключении закрыть все чаты в БД
            console.log(roomsChats);
        });
    });

    return io;
}

function joinChat(socket, user, chat) {
    socket.join('chat ' + chat, () => {
        console.log('join to chat');

    })
}

function leaveChat(socket, user, chat) {
    socket.leave('chat ' + chat, () => {
        console.log('leave to chat');

    })
}

function online(data) {
    User.findByIdAndUpdate(data._id, {
        platform: data.platform,
        state: true
    }).exec();
}

function offline(data) {
    User.findByIdAndUpdate(data._id, {
        lastAccess: Date.now(),
        state: false
    }).exec();
    log.info('Socket disconnect');
}
