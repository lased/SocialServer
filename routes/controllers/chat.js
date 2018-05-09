const async = require('async');
const mongoose = require('mongoose');

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const User = require('../../models/user');
const Chat = require('../../models/chat');
const http = require('../../http');
const config = require('../../config');

const uuid = require("uuid");

module.exports.removeChatUser = function (req, res, next) {
    let id = req.decoded_token._id;
    let chat = req.query.chat;
    let io = req.app.get('io');

    async.waterfall([
        c => {
            User.findById(id, (err, user) => {
                if (err) return c(err);

                let message = {
                    date: Date.now(),
                    message: {
                        text: user.surname + user.name + ' покинул беседу',
                        typeText: 'info'
                    }
                };

                Chat.findByIdAndUpdate(chat, {
                    $pull: {
                        users: {
                            _id: id
                        }
                    },
                    $push: {
                        messages: message

                    }
                }, (err, doc) => {
                    if (err) return c(err);

                    io.to('chat ' + chat).emit('chat message', message);

                    doc.users.forEach(el => {
                        User.findById(el._id).exec((err, user) => {
                            if (err) return c(err);

                            io.in('user ' + user.id).emit('chatsPageMessage', true);
                        });
                    })

                    if (doc.users.length == 1) {
                        Chat.remove({
                            _id: chat
                        }, (err) => {
                            if (err) return c(err);

                            rimraf(path.join(__dirname, "../../data/chats/" + chat), () => {});
                        })
                    }

                    c(null);
                });
            });
        },
        c => {
            User.updateOne({
                _id: id
            }, {
                $pull: {
                    chats: chat
                }
            }, (err, result) => {
                if (err) return c(err);

                c(null);
            });
        }
    ], (err, result) => {
        if (err) return res.json(http(500));

        io.in('user ' + req.decoded_token.id).emit('deleteChat', chat);

        res.json(http(200));
    });
}

module.exports.createChat = function (req, res, next) {
    let data = req.decoded_token;
    let _id = new mongoose.Types.ObjectId;
    let dir = path.join(__dirname, "../../data/chats/" + _id);
    let users = [data._id];

    for (let prop in req.body.users) {
        users.push(prop);
    }

    Chat.findOne({
        users: {
            $size: users.length
        },
        "users._id": {
            $all: users
        }
    }).exec((err, chat) => {
        if (err) return res.json(http(500));

        if (!chat) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
                fs.mkdirSync(dir + '/files');
            }

            let doc = {
                _id,
                messages: [],
                name: req.body.name,
                avatar: '/data/images/default-group-chat.png',
                users: []
            }

            let creator;

            async.forEach(users, (user, c) => {
                User.findByIdAndUpdate(user, {
                    $push: {
                        chats: doc._id
                    }
                }, (err, u) => {
                    if (err) return c(err);

                    let full = u.surname + ' ' + u.name;

                    if (user == data._id) {
                        creator = full;
                        doc.users.push({
                            _id: data._id,
                            main: true,
                            online: true,
                            unread: 0
                        });
                        doc.messages.push({
                            date: Date.now(),
                            message: {
                                text: creator + ' создал беседу',
                                typeText: 'info'
                            }
                        });
                    } else {
                        if (users.length == 2) {
                            doc.name = full;
                            doc.avatar = u.avatar;
                        }
                        doc.users.push({
                            _id: u._id,
                            main: false,
                            online: false,
                            unread: 1
                        });
                        doc.messages.push({
                            date: Date.now(),
                            message: {
                                text: creator + ' пригласил ' + full,
                                typeText: 'info'
                            }
                        });
                    }

                    let io = req.app.get('io');

                    io.in('user ' + u.id).emit('createChat', doc._id);
                    c();
                });
            }, err => {
                if (err) return res.json(http(500));

                let newChat = new Chat(doc);

                newChat.save((err, chat) => {
                    if (err) return res.json(http(500));

                    res.json(http(200));
                });
            });
        } else {
            res.json(http(302, "Chat exists"));
        }
    })
}

module.exports.getMessages = function (req, res, next) {
    let id = req.decoded_token._id;
    let chat = req.query.chat;

    Chat.findById(chat).populate('messages.from users._id', 'name surname avatar url')
        .exec((err, chat) => {
            if (err) return res.json(http(500));

            if (chat.users.length == 2) {
                chat = addDataChat(chat, id);
            }
            res.json(http(200, chat));
        });
}

module.exports.getChats = function (req, res, next) {
    let id = req.decoded_token._id;

    User.findById(id)
        .select('-_id chats')
        .populate({
            path: 'chats',
            select: {
                messages: {
                    $slice: -1
                }
            },
            options: {
                sort: {
                    "messages.date": -1
                }
            },
            populate: {
                path: 'users._id',
                select: 'name surname avatar state platform url'
            }
        })
        .exec((err, user) => {
            if (err) return res.json(http(500));

            let i = 0;

            while (i < user.chats.length) {
                let chat = user.chats[i];

                if (chat.users.length <= 2) {
                    chat = addDataChat(chat, id);
                }

                let index = chat.users.findIndex(el => {
                    return el._id._id == id;
                });

                user.chats[i].unread = chat.users[index]['unread'];
                i++;
            }
            res.json(http(200, {
                chats: user.chats
            }));
        })
}

module.exports.writeMessage = function (req, res, next) {
    let from = req.decoded_token._id;
    let files = req.files;
    let data = req.body;
    let to = data.id;
    let downloaded = data.downloadedFiles ? JSON.parse(data.downloadedFiles) : [];
    let io = req.app.get('io');

    if (data.type == 'box') {
        User.findById(from)
            .select('-_id chats')
            .populate({
                path: 'chats',
                select: '_id users',
                match: {
                    users: {
                        $size: 2
                    }
                }
            })
            .exec((err, docs) => {
                if (err) return res.json(http(500));

                let index = -1;
                let i = 0;

                while (i < docs.chats.length) {
                    let chat = docs.chats[i];

                    if (indexOfArray(chat.users, '_id', from) != -1 && indexOfArray(chat.users, '_id', to) != -1)
                        index = i;

                    i++;
                }

                if (docs && index != -1) {
                    let allFiles = uploadFiles(docs.chats[index]._id, {
                        downloaded,
                        upload: files
                    });
                    let query = {
                        $push: {
                            'messages': {
                                from,
                                date: Date.now(),
                                message: {
                                    text: data.message
                                },
                                files: allFiles
                            }
                        }
                    }

                    Chat.findByIdAndUpdate(docs.chats[index]._id, query, (err, chat) => {
                        if (err) return res.json(http(500));

                        res.json(http(200));
                    })
                } else {
                    let _id = new mongoose.Types.ObjectId;
                    let dir = path.join(__dirname, "../../data/chats/" + _id);

                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir);
                        fs.mkdirSync(dir + '/files');
                    }

                    let doc = {
                        _id,
                        messages: [{
                            from,
                            date: Date.now(),
                            message: {
                                text: data.message
                            },
                            files: uploadFiles(_id, {
                                downloaded,
                                upload: files
                            })
                        }],
                        users: [{
                                _id: from,
                                main: true,
                                online: false,
                                unread: 0
                            },
                            {
                                _id: to,
                                main: false,
                                online: false,
                                unread: 1
                            }
                        ]
                    }
                    let newChat = new Chat(doc);

                    newChat.save((err, chat) => {
                        let query = {
                            $push: {
                                'chats': chat._id
                            }
                        }

                        async.waterfall([
                            (callback) => {
                                User.findByIdAndUpdate(from, query, (err, user) => {
                                    if (err) return callback(err);

                                    io.in('user ' + user.id).emit('createChat', chat._id);
                                    callback(null);
                                });
                            },
                            (callback) => {
                                User.findByIdAndUpdate(to, query, (err, user) => {
                                    if (err) return callback(err);

                                    io.in('user ' + user.id).emit('createChat', chat._id);
                                    callback(null);
                                })
                            }
                        ], (err, result) => {
                            if (err) return res.json(http(500));

                            res.json(http(200));
                        });
                    });
                }
            });
    } else if (data.type == 'chat') {
        let allFiles = uploadFiles(to, {
            downloaded,
            upload: files
        });
        let message = {
            from,
            date: Date.now(),
            message: {
                text: data.message
            },
            files: allFiles
        };
        let query = {
            $push: {
                "messages": message
            }
        };

        async.waterfall([
            (c) => {
                Chat.updateOne({
                    _id: to
                }, query).exec((err, chat) => {
                    if (err) return c(err);

                    c(null);
                });
            },
            (c) => {
                Chat.findById(to).populate('messages.from', 'name surname avatar url')
                    .select({
                        messages: {
                            $slice: -1
                        }
                    })
                    .exec((err, chat) => {
                        if (err) return c(err);

                        io.to('chat ' + to).emit('chat message', chat.messages[0]);

                        chat.users.forEach(el => {
                            User.findById(el._id).exec((err, user) => {
                                if (err) return c(err);

                                io.in('user ' + user.id).emit('chatsPageMessage', true);
                            });
                        })

                        c(null);
                    });
            },
            (c) => {
                query = {
                    $inc: {
                        "users.$.unread": 1
                    }
                };
                Chat.updateOne({
                        _id: to,
                        "users.online": false
                    }, query)
                    .exec((err, chat) => {
                        if (err) return c(err);

                        c(null);
                    });
            }
        ], (err, result) => {
            if (err) return res.json(http(500));

            res.json(http(200));
        });
    }
}

function uploadFiles(chatId, files) {
    let imagePath = path.join(__dirname, "../../data/chats/" + chatId + "/files/")
    let downloaded = files.downloaded;
    let upload = files.upload;

    let allFiles = [];

    for (let i = 0; i < upload.length; i++) {
        let tempPath = upload[i].path;
        let type = upload[i].originalname.split('.');
        let UUID = uuid();
        let targetPath = imagePath + UUID + '.' + type[type.length - 1];

        allFiles.push({
            date: Date.now(),
            file: "/data/chats/" + chatId + "/files/" + UUID + '.' + type[type.length - 1]
        })

        fs.exists(targetPath, function (bool) {
            if (bool) {
                fs.unlink(tempPath, function (err) {
                    if (err) return res.json(http(400));
                })
            } else {
                fs.rename(tempPath, targetPath, function (err) {
                    if (err) return res.json(http(400));
                });
            }
        });
    }

    for (let i = 0; i < downloaded.length; i++) {
        allFiles.push({
            date: Date.now(),
            file: downloaded[i].file.name
        });
    }

    return allFiles;
}

function addDataChat(chat, userId) {
    let i = chat.users.findIndex(el => {
        return el['_id']['_id'] == userId;
    })

    i = chat.users.length == 1 ? 0 : +!i;
    chat.avatar = chat.users[i]._id.avatar;
    chat.name = chat.users[i]._id.surname + ' ' + chat.users[i]._id.name;
    chat.state = chat.users[i]._id.state;
    chat.platform = chat.users[i]._id.platform;

    return chat;
}

function indexOfArray(arrObj, field, val) {
    return arrObj.findIndex(el => {
        return el[field] == val;
    })
}