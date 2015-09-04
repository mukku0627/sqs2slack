var ConfigFile = require('config');

var AWS = require('aws-sdk');
AWS.config.loadFromPath(ConfigFile.aws.config);
AWS.config.region = ConfigFile.aws.region;

var sqs = new AWS.SQS();
var endpoint = ConfigFile.aws.sqs.url;

setInterval(
    function(){ receiveMessage() },
    ConfigFile.interval
);

// キュー処理(受信、削除)
var receiveMessage = function() {
    var params = {
        QueueUrl: endpoint,
        MaxNumberOfMessages: 10,
        MessageAttributeNames: [
            'STRING_VALUE',
        ]
    };
    sqs.receiveMessage(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            var messages = data.Messages;
            for (var mes in messages) {
                var body = JSON.parse(messages[mes].Body);
                if (body.AlarmName) {
                    sendSlack(body);
                } else {
                    console.log('送信しないメッセージ');
                }
                deleteMessage(messages[mes].ReceiptHandle);
            }
        }
    });
}

// 受け取ったReceiptHandleのメッセージを削除
var deleteMessage = function(receipt) {
    var params = {
        QueueUrl: endpoint,
        ReceiptHandle: receipt
    };
    sqs.deleteMessage(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log('OK');
            console.log(data);
        }
    });
}

// slack送信
var sendSlack = function(body) {
    var request = require('request');
    
    var message = "AlarmName: " + body.AlarmName + " (" + body.StateChangeTime + ") \\n "
               + "Status: " + body.OldStateValue + " → " + body.NewStateValue + " \\n "
               + "Reason: " + body.NewStateReason;

    var emoji = body.NewStateValue == "OK" ? ConfigFile.slack.icon_emoji.ok : ConfigFile.slack.icon_emoji.ng
    var payload = '{"text": "' + message 
            + '", "channel": "' + ConfigFile.slack.channel 
            + '", "username": "' + ConfigFile.slack.username
            + '", "icon_emoji": "' + emoji + '"}';
    var options = {
        uri:  ConfigFile.slack.url,
        form: { payload: payload},
        json: true
    }
    request.post(options, function(error, response, body) {
        if(!error && response.statusCode == 200) {
            console.log(body);
        } else {
            // error
            console.log("error.");
            console.log(body);
        }
    });
}
