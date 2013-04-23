$(function() {

  // 'http://localhost' if you're deploying your own application. We need to specify port 80 for io.connect or it will default to whatever port you're using for development
  var serverPath = 'http://zensockets.jit.su';
  var socket = io.connect(serverPath, {port: 80});

  socket.on('system', function (data) {
    console.log(data);
  });

  /* Encode! button */
  $('#start').click(function() {
    var input = $('#input-file').val();
    var request_body = { input_file: input };

    $.post(serverPath + '/submit-job', request_body, function(data) {
      jobSocket(data);
      console.log('Sent job request...');
    });
  });

  function jobSocket(response) {
    socket.on(response.notification_namespace, function(data) {
      if (data.type == 'job.create') { // Just the initial job created callback
        if (data.code == 201) {
          $('#notifications').append("<div class='alert alert-success'><strong>Job submitted!</strong> File is currently being encoded into " + data.outputs.count + " formats. <a href='https://app.zencoder.com/jobs/" + data.job_id + "' target='_blank'>View job</a></div>");
          $('#outputs').html("<h2>Outputs</h2><div class='row-fluid'><ul class='thumbnails'></ul></div>");
          $.each(data.outputs, function(key, value) {
            $('.thumbnails').append("<li class='span4 clearfix' id='" + value.id + "'><div class='thumbnail'><img src='http://placehold.it/1280x720'/1><div class='caption'><h4>" + value.label + "<a class='btn btn-small btn-warning pull-right' href='https://app.zencoder.com/output_media_files/" + value.id + " target='_blank'><i class='icon-spinner icon-spin loading'></i> Working</a></h4></div></div></li>");
          });
        } else {
          $('#notifications').append("<div class='alert alert-error'><strong>Request failed</strong> We were unable to create a job at this time. Sorry about that.");
        }
      } else { // Any other notification
        if (data.output && data.output.event) { // Output event notification (instant play)
          outputState(data.output.event, data);
          return;
        } else if (data.output) { // Output finished notification
          outputState(data.output.state, data);
          return;
        } else { // Job finished notification
          jobState(data);
        }
      }
    });
  }

  function jobState(notification) {
    var alert;
    switch(notification.job.state) {
      case 'failed':
        alert = "<div class='alert alert-error'><strong>Job Failed!</strong> Some of the outputs may have succeeded, but at least one failed.</div>";
        break;
      case 'processing':
        console.log('Job still in progress...');
        break;
      case 'finished':
        alert = "<div class='alert alert-success'><strong>Job Success!</strong> Congratulations, the whole job is finished.</div>";
        break;
    }
    return $('#notifications').append(alert);
  }

  function outputState(type, notification) {
    $('#' + notification.output.id + ' .loading').remove();

    if (notification.output.thumbnails) { 
      $('#' + notification.output.id + ' .thumbnail img').attr('src', notification.output.thumbnails[0].images[0].url)
    }

    var btn   = $('#' + notification.output.id + ' h4 .btn');

    switch(type) {
      case 'failed':
        btn.removeClass().addClass('btn btn-small btn-danger pull-right').html('<i class="icon-warning-sign"></i> Failed');
        break;
      case 'finished':
        btn.removeClass().addClass('btn btn-small btn-success pull-right').html('<i class="icon-ok"></i> Done');
        break;
      case 'first_segment_uploaded':
        btn.removeClass().addClass('btn btn-small btn-info pull-right').html('<i class="icon-cloud-upload"></li> Uploading');
        $('#' + notification.output.id + ' .thumbnail img').remove();
        $('#' + notification.output.id + ' .thumbnail').prepend('<video id="hls_player" class="video-js vjs-default-skin" controls></video>');
        _V_("hls_player")
          .src({ src: notification.output.url, type: "application/x-mpegURL" })
          .volume(0.5)
          .ready(function(){
            var myPlayer = this;    // Store the video object
            var aspectRatio = 9/16; // Make up an aspect ratio

            function resizeVideoJS(){
              // Get the parent element's actual width
              var width = document.getElementById(myPlayer.id).parentElement.offsetWidth - 10; // the -10 is to take padding into account
              // Set width to fill parent element, Set height
              myPlayer.width(width).height( width * aspectRatio );
            }

            resizeVideoJS(); // Initialize the function
            window.onresize = resizeVideoJS; // Call the function on resize
          });
        break;
      case 'seamless_playback':
        btn.removeClass().addClass('btn btn-small btn-primary pull-right').html('<i class="icon-play-circle"></i> Play');
        _V_("hls_player").play();
        break;
    }
  }

});