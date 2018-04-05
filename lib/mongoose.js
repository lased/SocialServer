var mongoose = require('mongoose');
var config = require('../config');
var log = require('./log')(module);

mongoose.connect(config.get('mongoose:uri'), config.get('mongoose:options'));

mongoose.connection.on('error', function(err){
    log.error("Ошибка БД")
});

mongoose.connection.on('connected', function(){
    log.info("Подключено к БД")
});

mongoose.connection.on('disconnected', function(){
    log.info("Отключено от БД")
});

module.exports = mongoose;