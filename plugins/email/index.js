
var CheckEvent = require('../../models/checkEvent');

exports.initWebApp = function(options) {
  
  var config = options.config.email;
  CheckEvent.on('afterInsert', function(checkEvent) {
    if (!config.event[checkEvent.message]) return;
    checkEvent.findCheck(function(err, check) {
      if (err) return console.error(err);
      var nodemailer = require('nodemailer');

      var transporter = nodemailer.createTransport(config.transport);

      var mailOptions = {
        from:    config.message.from,
        to:      config.message.to,
        subject: 'Site Status',
        text:    check.name + ' ' + checkEvent.message
      };

      transporter.sendMail(mailOptions, function(error, info){
        console.log('Notified event by email: Check ' + check.name + ' ' + checkEvent.message);
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
    });
  });
  console.log('Enabled Email notifications');
};
