const async = require('async');
const mongoose = require('mongoose');

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const User = require('../../models/user');
const Group = require('../../models/group');
const http = require('../../http');

const uuid = require("uuid");

module.exports.addPost = function (req, res, next) {
    let groupId = req.body.id;
    let post = req.body.post;
    let downloaded = req.body.downloadedFiles ? JSON.parse(req.body.downloadedFiles) : [];
    let files = req.files;
    let doc = {
        date: new Date(),
        post,
        files: uploadFiles(groupId, {
            downloaded,
            upload: files
        })
    }

    Group.updateOne({ _id: groupId }, { $push: { posts: doc } }, (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200, doc));
    });
}

module.exports.deletePost = function (req, res, next) {
    let groupId = req.query.id;
    let post = JSON.parse(req.query.post);

    Group.updateOne({ _id: groupId }, { $pull: { posts: { _id: post._id } } }, (err, result) => {
        if (err) return res.json(http(500));

        post.files.forEach(item => {
            if (fs.existsSync(path.join(__dirname, '../../' + item.file)))
                fs.unlinkSync(path.join(__dirname, '../../' + item.file));
        })

        res.json(http(200));
    })
}

module.exports.addEvent = function (req, res, next) {
    let event = req.body.event;
    let groupId = req.body.id;

    Group.updateOne({ _id: groupId }, { $push: { events: event } }, (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    })
}

module.exports.removeEvent = function (req, res, next) {
    let event = JSON.parse(req.query.event);
    let groupId = req.query.id;

    Group.updateOne({ _id: groupId }, {
        $pull: {
            events: event
        }
    }, (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    })
}

module.exports.importShedule = function (req, res, next) {
    let lowerWeek = req.body.shedule.lowerWeek || [];
    let topWeek = req.body.shedule.topWeek || [];
    let pairs = req.body.shedule.pairs || [];
    let groupId = req.body.groupId;

    Group.updateOne({ _id: groupId }, {
        "shedule.lowerWeek": lowerWeek,
        "shedule.topWeek": topWeek,
        "shedule.pairs": pairs
    }, (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    })
}

module.exports.addShedule = function (req, res, next) {
    let lowerWeek = req.body.shedule.lowerWeek;
    let topWeek = req.body.shedule.topWeek;
    let groupId = req.body.groupId;

    Group.updateOne({ _id: groupId }, { "shedule.lowerWeek": lowerWeek, "shedule.topWeek": topWeek }, (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    })
}

module.exports.addPairs = function (req, res, next) {
    let pairs = req.body.pairs;
    let groupId = req.body.groupId;

    Group.updateOne({ _id: groupId }, { "shedule.pairs": pairs }, (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    })
}

module.exports.updateDataGroup = function (req, res, next) {
    let data = req.body.data;
    let id = data.id;

    delete data.id;

    Group.findById(id).exec((err, group) => {
        if (err) return res.json(http(500));

        if (data.url.length == 0) {
            data.url = 'id' + group.id;
        }

        Group.updateOne({ _id: id }, data, (err, result) => {
            if (err) return res.json(http(500));

            res.json(http(200, { name: data.name }));
        });
    });
}

module.exports.setAvatar = function (req, res, next) {
    let id = req.body.id;
    let image = req.file;
    let tempPath = image.path;
    let UUID = uuid();
    let type = image.originalname.split('.');
    let name = UUID + '.' + type[type.length - 1];
    let targetPath = path.join(__dirname, "../../data/groups/" + id + "/files/") + name;
    let avatar = "/data/groups/" + id + "/files/" + name;

    fs.exists(targetPath, function (bool) {
        let io = req.app.get('io');

        if (bool) {
            fs.unlink(tempPath, function (err) {
                if (err) {
                    return res.json(http(400));
                }

                res.json(http(302, 'Photo exists'));
            })
        } else {
            fs.rename(tempPath, targetPath, function (err) {
                if (err)
                    res.json(http(400));
                else {
                    Group.findByIdAndUpdate(id, {
                        avatar
                    }, (err, group) => {
                        if (err) return res.json(http(500));

                        if (group.avatar != '/data/images/default-group-avatar.jpg')
                            fs.unlinkSync(path.join(__dirname, "../.." + group.avatar));

                        io.emit('group ' + group._id + ' avatar', avatar);
                        res.json(http(200));
                    });
                }
            });
        }
    });
}

module.exports.deleteGroup = function (req, res, next) {
    let id = req.query.id;
    let dir = path.join(__dirname, "../../data/groups/" + id);

    Group.findByIdAndRemove(id, (err, group) => {
        if (err) return res.json(http(500));

        rimraf(dir, () => { });
        group.users.forEach(el => {
            User.updateOne({
                _id: el.user
            }, {
                    $pull: {
                        groups: group._id
                    }
                }).exec();
        })

        res.json(http(200));
    });
}

module.exports.joinGroup = function (req, res, next) {
    let userId = req.decoded_token._id;
    let groupId = req.body.id;

    async.waterfall([
        c => {
            Group.findByIdAndUpdate(groupId, {
                $push: {
                    users: {
                        user: userId,
                        main: false
                    }
                }
            }).exec((err, group) => {
                if (err) return c(err);

                c(null);
            });
        },
        c => {
            User.updateOne({
                _id: userId
            }, {
                    $push: {
                        groups: groupId
                    }
                }).exec((err, result) => {
                    if (err) return c(err);

                    c(null);
                })
        }
    ], (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    });
}

module.exports.getGroup = function (req, res, next) {
    let url = req.query.url;

    Group.findOne({
        url
    })
        .populate({
            path: 'users.user',
            select: 'avatar url name surname'
        })
        .exec((err, group) => {
            if (err) return res.json(http(500));

            if (group)
                group.posts.sort((prev, cur) => {
                    if (cur.files.length > 0) {
                        cur.files.sort((prev, cur) => {
                            if (/\.(jpg|jpeg|png|gif)$/.test(cur.file)) {
                                return 1;
                            }
                            return 0;
                        })
                    }

                    return +cur.date - +prev.date;
                })

            res.json(http(200, group));
        });
}

module.exports.leaveGroup = function (req, res, next) {
    let userId = req.decoded_token._id;
    let groupId = req.query.id;

    async.waterfall([
        c => {
            Group.updateOne({
                _id: groupId
            }, {
                    $pull: {
                        users: {
                            user: userId
                        }
                    }
                }).exec((err, result) => {
                    if (err) return c(err);

                    c(null);
                });
        },
        c => {
            User.updateOne({
                _id: userId
            }, {
                    $pull: {
                        groups: groupId
                    }
                }).exec((err, result) => {
                    if (err) return c(err);

                    c(null);
                })
        }
    ], (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    });
}

module.exports.getUserGroups = function (req, res, next) {
    let id = req.decoded_token._id;

    User.findById(id).select('groups').populate({
        path: 'groups',
        select: 'avatar name url users',
        populate: {
            path: 'users.user',
            select: 'url'
        }
    }).exec((err, user) => {
        if (err) return res.json(http(500));

        res.json(http(200, user.groups));
    })
}

module.exports.createGroup = function (req, res, next) {
    let name = req.body.name;
    let description = req.body.description;
    let id = req.decoded_token._id;
    let _id = new mongoose.Types.ObjectId;
    let dir = path.join(__dirname, "../../data/groups/" + _id);
    let doc = {
        _id,
        name,
        description,
        dateCreated: Date.now(),
        users: [{
            user: id,
            main: true
        }],
        posts: []
    }

    Group.count({
        _id: {
            $ne: null
        }
    }).exec((err, count) => {
        if (err) return res.json(http(500));

        if (!count) {
            doc.id = 1
        } else {
            doc.id = count + 1;
        }

        doc.url = `id${doc.id}`;

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
            fs.mkdirSync(dir + '/files');
        }

        let newGroup = new Group(doc);

        User.updateOne({
            _id: id
        }, {
                $push: {
                    groups: _id
                }
            }).exec((err, result) => {
                if (err) return res.json(http(500));
            })

        newGroup.save();
        res.json(http(200));
    })
}


function uploadFiles(groupId, files) {
    let imagePath = path.join(__dirname, "../../data/groups/" + groupId + "/files/")
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
            file: "/data/groups/" + groupId + "/files/" + UUID + '.' + type[type.length - 1]
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