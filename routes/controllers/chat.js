const async = require('async');
const mongoose = require('mongoose');

const fs = require('fs');
const path = require('path');

const User = require('../../models/user');
const Chat = require('../../models/chat');
const http = require('../../http');
const config = require('../../config');

const uuid = require("uuid");

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

                if (chat.users.length == 2) {
                    chat = addDataChat(chat, id);
                }

                i++;
            }
            res.json(http(200, { chats: user.chats }));
        })
}

module.exports.writeMessage = function (req, res, next) {
    let from = req.decoded_token._id;
    let files = req.files;
    let data = req.body;
    let to = data.id;
    let downloaded = data.downloadedFiles ? JSON.parse(data.downloadedFiles) : [];

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
                let allFiles = uploadFiles(docs.chats[index]._id, { downloaded, upload: files });
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
                    messages: [
                        {
                            from,
                            date: Date.now(),
                            message: {
                                text: data.message
                            },
                            files: uploadFiles(_id, { downloaded, upload: files })
                        }
                    ],
                    users: [
                        {
                            _id: from,
                            main: true,
                            online: false,
                            unread: 0
                        },
                        {
                            _id: to,
                            main: false,
                            online: false,
                            unread: 0
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
                                callback(null)
                            });
                        },
                        (callback) => {
                            User.findByIdAndUpdate(to, query, (err, user) => {
                                if (err) return callback(err);
                                callback(null)
                            })
                        }
                    ], (err, result) => {
                        if (err) return res.json(http(500));

                        res.json(http(200));
                    });
                });
            }
        });
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

        allFiles.push({ date: Date.now(), file: "/data/chats/" + chatId + "/files/" + UUID + '.' + type[type.length - 1] })

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
        allFiles.push({ date: Date.now(), file: downloaded[i].file.name });
    }

    return allFiles;
}

function addDataChat(chat, userId) {
    let index = chat.users.findIndex(el => {
        return el['_id']['_id'] == userId;
    })

    chat.users.splice(index, 1);
    chat.avatar = chat.users[0]._id.avatar;
    chat.name = chat.users[0]._id.surname + ' ' + chat.users[0]._id.name;

    return chat;
}

function indexOfArray(arrObj, field, val) {
    return arrObj.findIndex(el => {
        return el[field] == val;
    })
}