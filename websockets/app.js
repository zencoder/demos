
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , config = require('./config')
  , Zencoder = require ('zencoder').Zencoder
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

Zencoder.prototype.api_key = config.zencoder;

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);

app.post('/notify/:id', function(req, res) {
  io.sockets.emit(req.params.id, req.body)
  res.send(204, {});
});

app.post('/submit-job', function(req, res) {
  // Alow CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  var random_string = Math.random().toString(36).substring(7);

  var notification_url = config.notificationUrl + random_string;

  Zencoder.prototype.Job.create({
    input: req.body.input_file,
    notifications: notification_url,
    outputs: [
      {
        label: 'MP4',
        url: config.outputUrl + 'output.mp4',
        notifications: notification_url,
        public: true,
        thumbnails: {
          number: 1,
          base_url: config.outputUrl,
          filename: 'webm_{{number}}',
          public: true
        }
      },
      {
        label: 'WebM',
        url: 's3://zencodertesting/deleteme/sockets/output.webm',
        notifications: notification_url,
        public: true,
        thumbnails: {
          number: 1,
          base_url: config.outputUrl,
          filename: 'webm_{{number}}',
          public: true
        }
      },
      {
        label: 'instant-play',
        instant_play: true,
        type: 'segmented',
        base_url: config.outputUrl,
        notifications: [
          {
            event: 'first_segment_uploaded',
            url: notification_url
          },
          {
            event: 'seamless_playback',
            url: notification_url
          },
          {
            url: notification_url
          }
        ],
        headers: {
          'x-amz-acl': 'public-read'
        },
        access_control: [
          {
            permission: 'FULL_CONTROL',
            grantee: 'aws@zencoder.com'
          },
          {
            permission: 'READ',
            grantee: 'http://acs.amazonaws.com/groups/global/AllUsers'
          }
        ]
      }
    ]
  }, function(res) {
    if (res.code == 201) {
      io.sockets.emit(random_string, {code: res.code, type: 'job.create', message: 'Job created!', job_id: res.body.id, outputs: res.body.outputs})
    } else {
      console.log(res);
      io.sockets.emit(random_string, {code: res.code, type: 'job.create', message: 'Something has gone terribly wrong...'});
    }
  });
  res.send(200, {message: 'Success!', notification_namespace: random_string});
});

io.sockets.on('connection', function (socket) {
  socket.emit('system', { message: 'Connected!' });
});

server.listen(app.get('port'), function(){
  console.log("Zensockets started on port " + app.get('port'));
});