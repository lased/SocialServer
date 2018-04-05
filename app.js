const express = require('express');
const app = express();
const path = require('path');
const http = require('http').Server(app);
const logger = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const mongoose = require('./lib/mongoose');
const log = require('./lib/log')(module);

const config = require('./config');

if (app.get('env') == 'dev ') {
  app.use(logger('dev'));
}
else {
  app.use(logger('default'));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public/www')));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

app.use('/', require('./routes'));

http.listen(config.get('port') || process.env.PORT, function () {
  log.info('Сервер запущен на порту ' + config.get('port'));
});

const io = require("./socket")(http);
app.set('io', io);