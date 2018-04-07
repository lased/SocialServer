const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const async = require('async');
const uuid = require("uuid");

const fs = require('fs');
const path = require('path');

const User = require('../../models/user');
const http = require('../../http');
const config = require('../../config');

let settings = require('./settings.json').settings;

module.exports.getFiles = function (req, res, next) {
    let t = req.query.type;
    let data = req.decoded_token;

    let filePath = config.get('urlApi');

    User.findById(data._id, (err, user) => {
        if (err) return res.json(http(500));

        res.json(http(200, { path: filePath, files: user[t] }));
    });
}

module.exports.confirmAddFriend = function (req, res, next) {
    let idUser = req.decoded_token._id;
    let idNewUser = req.body.id;
    let data = {
        $set: {
            "friends.$.status": true
        }
    }

    async.waterfall([
        function (callback) {
            User.updateOne({ _id: idUser, "friends._id": idNewUser }, data, (err, user) => {
                if (err) return callback(err);

                callback(null);
            });
        },
        function (callback) {
            User.updateOne({ _id: idNewUser, "friends._id": idUser }, data, (err, user) => {
                if (err) return callback(err);

                callback(null);
            });
        }
    ], function (err, result) {
        if (err) return res.json(http(500));

        res.json(http(200));
    });
}

module.exports.cancelAddFriend = function (req, res, next) {
    let idUser = req.decoded_token._id;
    let idNewUser = req.query.id;
    let data = {
        $pull: {
            'friends': {
                _id: idUser,
            }
        }
    };

    async.waterfall([
        function (callback) {
            User.findByIdAndUpdate(idNewUser, data, (err, user) => {
                if (err) return callback(err);

                callback(null);
            });
        },
        function (callback) {
            data.$pull['friends']._id = idNewUser;

            User.findByIdAndUpdate(idUser, data, (err, user) => {
                if (err) return callback(err);

                callback(null);
            });
        }
    ], function (err, result) {
        if (err) return res.json(http(500));

        res.json(http(200));
    });
}

module.exports.friends = function (req, res, next) {
    let id = req.decoded_token._id;

    User.findById(id).populate('friends._id', 'url name surname avatar').exec(function (err, user) {
        if (err) return res.json(http(500));

        res.json(http(200, user.friends));
    })
}

module.exports.addFriend = function (req, res, next) {
    let idNewFriend = req.body.id;
    let userId = req.decoded_token._id;
    let data = {
        $push: {
            'friends': {
                _id: userId,
                status: null,
                input: true
            }
        }
    };

    async.waterfall([
        function (callback) {
            User.findByIdAndUpdate(idNewFriend, data, (err, user) => {
                if (err) return callback(err);

                callback(null);
            });
        },
        function (callback) {
            data.$push['friends']._id = idNewFriend;
            data.$push['friends'].input = false;

            User.findByIdAndUpdate(userId, data, (err, user) => {
                if (err) return callback(err);

                callback(null);
            });
        }
    ], function (err, result) {
        if (err) return res.json(http(500));

        res.json(http(200));
    });
}

module.exports.get = function (req, res, next) {
    let url = req.query.url;
    let fields;

    fields = '_id id name surname avatar phone birthday status about city country sex state lastAccess platform';
    User.findOne({ url }).select(fields).exec(function (err, user) {
        if (err) return res.json(http(500));

        if (user) {
            delete user._id;
            user.avatar = config.get('urlApi') + user.avatar;
            res.json(http(200, user));
        } else {
            res.json(http(404, 'User not found'));
        }
    });
}

module.exports.deletePhoto = function (req, res, next) {
    let data = req.decoded_token;
    let image = JSON.parse(req.query.image);
    let pathPhoto = path.join(__dirname, "../.." + image.name);
    let io = req.app.get('io');   
    
    User.findById(data._id, function (err, user) {
        if (err) return res.json(http(500));

        fs.unlink(pathPhoto, function (err) {
            if (err) return res.json(http(500));            

            User.findByIdAndUpdate(data._id, {
                $pull: {
                    'images': {
                        _id: image._id
                    }
                }
            }, (err, user) => {
                if (err) return res.json(http(500));                
            });
        })

        if (image.name == user.avatar) {
            let newAvatar = '/data/images/default-avatar.jpg';

            User.findByIdAndUpdate(data._id, { avatar: newAvatar }, function (err, user) {
                if (err) return res.json(http(500));

                io.to('user ' + data.id).emit('setAvatar', config.get('urlApi') + newAvatar);
                res.json(http(200));
            });
        } else {
            res.json(http(200));
        }
    })
}

module.exports.photoAvatar = function (req, res, next) {
    let data = req.decoded_token;
    let image = req.body.image;
    let avatar = image.name;
    let io = req.app.get('io');

    User.findByIdAndUpdate(data._id, { avatar }, function (err, user) {
        if (err) return res.json(http(500));

        io.to('user ' + data.id).emit('setAvatar', config.get('urlApi') + avatar);
        res.json(http(200));
    });
}

module.exports.addPhotos = function (req, res, next) {
    let data = req.decoded_token;
    let images = req.files;

    for (let i = 0; i < images.length; i++) {
        let tempPath = images[i].path;
        let type = images[i].originalname.split('.');
        let UUID = uuid();
        let targetPath = path.join(__dirname, "../../data/users/" + data.id + "/images/") + UUID + '.' + type[type.length - 1];
        
        fs.exists(targetPath, function (bool) {
            if (bool) {
                fs.unlink(tempPath, function (err) {
                    if (err) return res.json(http(400));
                })
            } else {
                fs.rename(tempPath, targetPath, function (err) {
                    if (err) return res.json(http(400));

                    User.findByIdAndUpdate(data._id, {
                        $push: {
                            "images": {
                                name: "/data/users/" + + data.id + "/images/" + UUID + '.' + type[type.length - 1],
                                date: Date.now()
                            }
                        }
                    }, (err, user) => {
                        if (err) return res.json(http(500));
                    });
                });
            }
        })
    }
    res.json(http(200));
}

module.exports.getPhotos = function (req, res, next) {
    let data = req.decoded_token;
    let photoPath = config.get('urlApi');

    User.findById(data._id, (err, user) => {
        if (err) return res.json(http(500));

        res.json(http(200, { path: photoPath, photos: user.images }));
    });
}

module.exports.setAvatar = function (req, res, next) {
    let data = req.decoded_token;
    let image = req.file;
    let tempPath = image.path;
    let UUID = uuid();
    let type = image.originalname.split('.');
    let name = UUID + '.' + type[type.length - 1];
    let targetPath = path.join(__dirname, "../../data/users/" + data.id + "/images/") + name;
    let avatar = config.get('urlApi') + "/data/users/" + data.id + "/images/" + name;
    let newAvatar = "/data/users/" + data.id + "/images/" + name;

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
                else
                    User.findByIdAndUpdate(data._id, { avatar: newAvatar, $push: { "images": { name: newAvatar, date: Date.now() } } }, function (err, user) {
                        if (err) return res.json(http(500));

                        io.in('user ' + data.id).emit('setAvatar', avatar);
                        res.json(http(200));
                    })
            });
        }
    })
}

module.exports.changeEmail = function (req, res, next) {
    let id = req.params.id;
    let hash = req.params.hash;
    let email = req.params.email;
    let hashId = crypto.createHash('md5').update(id).digest('hex');

    if (hashId == hash) {
        User.findByIdAndUpdate(id, {
            email
        }, function (err, docs) {
            if (err) return res.json(error(500));

            res.redirect('/');
        })
    } else {
        res.redirect('/');
    }
}

module.exports.setSettings = function (req, res, next) {
    let userData = req.decoded_token;
    let data = req.body.data;
    let io = req.app.get('io');

    if (data.newPassword !== undefined) {
        data.password = data.newPassword;
        delete data.newPassword;
    }

    User.findById(userData._id, function (err, user) {
        if (err) return res.json(http(500));

        if (!user) {
            res.json(http(404, 'User not found'));
        } else {
            console.log(data.name !== undefined && data.surname !== undefined);

            if (data.name && data.surname) {
                io.to('user ' + userData.id).emit('updateInitials', { name: data.name, surname: data.surname });
            }

            if (data.email !== undefined && data.email !== user.email) {
                let newEmail = data.email;

                User.findOne({ email: data.email }, function (err, mail) {
                    if (err) return res.json(http(500));

                    if (mail) {
                        res.json(http(302, { name: 'email' }));
                    } else {
                        sendMail('change email', {
                            _id: user._id,
                            oldEmail: user.email,
                            newEmail
                        })
                        delete data.email;

                        User.findByIdAndUpdate(user._id, data, function (err, user) {
                            if (err) return res.json(http(500));

                            res.json(http(200, 'change email'));
                        });
                    }
                })

            } else if (data.url !== undefined && data.url !== user.url) {
                if (/^id[0-9]+$/.test(data.url)) {
                    res.json(http(302, { name: 'url' }));
                } else {
                    io.to('user ' + userData.id).emit('updateUrl', { url: data.url == '' ? 'id' + userData.id : data.url });

                    User.findOne({ url: data.url }, function (err, u) {
                        if (err) return res.json(http(500));

                        if (u) {
                            res.json(http(302, { name: 'url' }));
                        } else {
                            data.url = data.url == '' ? 'id' + userData.id : data.url;
                            User.findByIdAndUpdate(user._id, data, function (err, user) {
                                if (err) return res.json(http(500));

                                res.json(http(200));
                            })
                        }
                    });
                }
            } else {
                User.findByIdAndUpdate(user._id, data, function (err, user) {
                    if (err) return res.json(http(500));

                    res.json(http(200));
                })
            }
        }
    });
}

module.exports.settings = function (req, res, next) {
    let data = req.decoded_token;

    User.findById(data._id, function (err, user) {
        if (err) return res.json(http(500));

        if (!user) {
            res.json(http(404, 'User not found'));
        } else {
            let settings = getSettings(user);

            res.json(settings);
        }
    })
}

module.exports.auth = function (req, res, next) {
    let token = req.body.token;

    jwt.verify(token, config.get('secret'), function (err, decode) {
        if (err) {
            res.json({
                ok: false
            })
        } else {
            User.findById(decode._id, function (err, user) {
                if (err || !user) {
                    res.json({
                        ok: false
                    });
                } else {
                    res.json({
                        ok: true,
                        data: {
                            avatar: config.get('urlApi') + user.avatar,
                            name: user.name,
                            surname: user.surname,
                            url: user.url,
                            state: user.state,
                            friends: user.friends
                        }
                    })
                }
            });
        }
    });
}
module.exports.forget = function (req, res, next) {
    let email = req.body.email;

    if (!email) {
        res.json(http(400));
    } else {
        User.findOne({
            email
        }, function (err, user) {
            if (err) return res.json(http(500));

            if (!user) {
                res.json(http(404, 'User not found'));
            } else {
                let data = {
                    email,
                    password: generatePassword(12)
                }

                sendMail('restoring password', data)
                User.findByIdAndUpdate(user._id, {
                    password: data.password
                }, function (err, docs) {
                    if (err) return res.json(http(500));

                    res.json(http(200));
                })
            }
        });
    }
}

module.exports.login = function (req, res, next) {
    let email = req.body.email;
    let password = req.body.password;
    let err = email && password;

    if (err == undefined) {
        res.json(http(400));
    } else {
        User.findOne({
            email,
            password
        }, function (err, user) {
            if (err) return res.json(http(500));

            if (!user) {
                res.json(http(404, 'User not found'));
            } else {
                if (user.activated) {
                    let data = selectedField(user),
                        token = jwt.sign({ _id: data._id, id: data.id }, config.get('secret'));

                    data.token = token;
                    delete data._id;
                    delete data.id;
                    res.json(http(200, data));
                } else {
                    res.json(http(510));
                }
            }
        });
    }
}

module.exports.activate = function (req, res, next) {
    let id = req.params.id;
    let hash = req.params.hash;
    let hashId = crypto.createHash('md5').update(id).digest('hex');

    if (hashId == hash) {
        User.findByIdAndUpdate(id, {
            activated: true
        }, function (err, docs) {
            if (err) return res.json(error(500));

            let dir = path.join(__dirname, '../../data/users/' + docs.id);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
                fs.mkdirSync(dir + '/images');
                fs.mkdirSync(dir + '/docs');
            }

            res.redirect('/');
        })
    } else {
        res.redirect('/');
    }
}

module.exports.registration = function (req, res, next) {
    let data = req.body;
    let err = data.surname && data.name && data.password && data.email;

    if (err == undefined) {
        res.json(http(400));
    } else {
        let userParams = data;

        userParams.dateCreated = userParams.lastAccess = Date.now();

        userParams.chats = userParams.groups = userParams.notifications =
            userParams.wall = userParams.friends = userParams.docs = userParams.images = [];

        userParams.activated = false;

        userParams.state = userParams.sex = userParams.country =
            userParams.city = userParams.about = userParams.status =
            userParams.url = userParams.birthday = userParams.phone = userParams.platform = null;

        userParams.avatar = '/data/images/default-avatar.jpg';

        User.findOne({
            'email': userParams.email
        }, function (err, docs) {
            if (err) return res.json(http(500));

            if (docs) return res.json(http(302, 'User exists'));

            if (!docs) {
                User.count({
                    _id: {
                        $ne: null
                    }
                }, function (err, count) {
                    let user;

                    if (err) return res.json(http(500));

                    if (!count) {
                        userParams.id = 1;
                    } else {
                        userParams.id = count + 1;
                    }

                    userParams.url = "id" + userParams.id;
                    user = new User(userParams);
                    user.save(function (err, user) {
                        if (err) return res.json(http(500));

                        sendMail('activate mail', user);
                        res.json(http(200))
                    });
                })
            }
        });
    }
}

function selectedField(user) {
    return {
        id: user.id,
        _id: user._id,
        avatar: config.get("urlApi") + user.avatar,
        surname: user.surname,
        name: user.name,
        url: user.url,
        state: user.state,
        friends: user.friends
    }
}

function sendMail(type, data) {
    const transporter = nodemailer.createTransport({
        service: config.get("mail:service"),
        auth: {
            user: config.get("mail:user"),
            pass: config.get("mail:pass")
        }
    });
    let mailOptions = {};

    if (type == 'activate mail') {
        let hash = crypto.createHash('md5').update(data._id.toString()).digest('hex');

        mailOptions = {
            from: 'Социальная сеть Соколова Руслана <61sokolovruslan61@gmail.com>',
            to: data.email,
            subject: 'Подтверждение регистрации',
            html: '<b>Для активации аккаунта перейдите по ссылке:</b> <a href="' + config.get("urlApi") + '/api/user/activate/' + data._id + '/' + hash + '">перейти</a>'
        };
    } else if (type == 'restoring password') {
        mailOptions = {
            from: 'Социальная сеть Соколова Руслана <61sokolovruslan61@gmail.com>',
            to: data.email,
            subject: 'Восстановление учетной записи',
            html: 'Ваш новый пароль: <b>' + data.password + '</b>'
        };
    } else if (type == 'change email') {
        let hash = crypto.createHash('md5').update(data._id.toString()).digest('hex');

        mailOptions = {
            from: 'Социальная сеть Соколова Руслана <61sokolovruslan61@gmail.com>',
            to: data.oldEmail,
            subject: 'Изменение почтового адреса учетной записи',
            html: '<b>Для смены почтового адреса перейдите по ссылке:</b> <a href="' + config.get("urlApi") + '/api/user/change/email/' + data._id + '/' + hash + '/' + data.newEmail + '">перейти</a>'
        };
    }

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            return console.log(err);
        }
    });
}

function generatePassword(count) {
    let pass = "";
    let alphabet = [
        'a', 'b', 'c', 'd', 'e', 'f',
        'g', 'h', 'i', 'j', 'k', 'l',
        'm', 'n', 'o', 'p', 'r', 's',
        't', 'u', 'v', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F',
        'G', 'H', 'I', 'J', 'K', 'L',
        'M', 'N', 'O', 'P', 'R', 'S',
        'T', 'U', 'V', 'X', 'Y', 'Z',
        '1', '2', '3', '4', '5', '6',
        '7', '8', '9', '0', '.', ',',
        '(', ')', '[', ']', '!', '?',
        '&', '^', '%', '@', '*', '$',
        '<', '>', '/', '|', '+', '-',
        '{', '}', '`', '~'
    ];

    for (let i = 0; i < count; i++) {
        let index = Math.floor(Math.random() * (alphabet.length + 1));

        pass += alphabet[index];
    }

    return pass;
}

function getSettings(user) {
    let i = 0;

    while (i < settings.length) {
        let parametrs = settings[i].parametrs
        let j = 0;

        while (j < parametrs.length) {
            parametrs[j].value = user[parametrs[j].name];
            j++;
        }

        i++;
    }

    return settings;
}

// function addNotification(userId, )