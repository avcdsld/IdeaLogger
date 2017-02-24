var CHANNEL_ACCESS_TOKEN = 'dummy'; // please set your channel access token

var line_endpoint = 'https://api.line.me/v2/bot/message/reply';
var line_endpoint_profile = 'https://api.line.me/v2/bot/profile';

function getUserDisplayName(user_id) {
  var res = UrlFetchApp.fetch(line_endpoint_profile + '/' + user_id, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'get',
  });
  return JSON.parse(res).displayName;
}

function createSpreadSheet(user_id) {
  var spreadSheet = SpreadsheetApp.create("idea(" + getUserDisplayName(user_id) + ")");
  var sheet = spreadSheet.getSheets()[0];
  sheet.appendRow(['日時', 'メッセージ']);
  PropertiesService.getScriptProperties().setProperty(user_id, spreadSheet.getId());
  var file = DriveApp.getFileById(spreadSheet.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 300);
  return spreadSheet;
}

function getSpreadSheet(user_id) {
  var sid = PropertiesService.getScriptProperties().getProperty(user_id);
  if (sid == null) {
    return createSpreadSheet(user_id);
  } else {
    try {
      return SpreadsheetApp.openById(sid);
    } catch(e) {
      return createSpreadSheet(user_id);
    }
  }
}

function addToSpreadSheet(user_id, message) {
  var today = new Date();
  var spreadSheet = getSpreadSheet(user_id);
  var sheet = spreadSheet.getSheets()[0];
  sheet.appendRow([today, message]);
}

function getRandom(num) {
  return Math.ceil(Math.random() * (num - 1));
}

function getIdea(spreadSheet, num) {
  var sheet = spreadSheet.getSheets()[0];
  var time = Utilities.formatDate(sheet.getRange((num + 1), 1).getValue(), 'Asia/Tokyo', 'yyyy/MM/dd hh:mm a');
  var message = sheet.getRange((num + 1), 2).getValue();
  return "(" + time + ")\n" + message;
}

function getRandomIdeas(spreadSheet) {
  var ideas = [];
  var sheet = spreadSheet.getSheets()[0];
  var rowNum = sheet.getLastRow();
  if (rowNum < 1) {
    ideas.push('ゴメンナサイ、この機能を使うには、ある程度の数のアイデアが必要です。アイデアをいくつか入力してみてください。');
  } else {
    ideas.push('あなたは以前、こんなアイデアを考えていました。');
    var num = getRandom(rowNum);
    ideas.push(getIdea(spreadSheet, num));
    var num2
    for (var i = 0; i < 100; i++) {
      num2 = getRandom(rowNum);
      if (num != num2) {
        break;
      }
    }
    ideas.push(getIdea(spreadSheet, num2));
  }
  return ideas;  
}

function doPost(e) {
  var json = JSON.parse(e.postData.contents);  

  var reply_token= json.events[0].replyToken;
  if (typeof reply_token === 'undefined') {
    return;
  }

  var user_id = json.events[0].source.userId;
  var user_message = json.events[0].message.text;  
  
  var reply_messages;
  var spreadSheet;
  if ('ヘルプ' == user_message) {
    reply_messages = ["スプレッドシートにアクセスしたい場合は「スプレッドシート」と入力してください。\n\nアイデアを思い出したくなったら「アイデア」と入力してください。あなたの過去のアイデアをランダムにお伝えします。\n\n使い方がわからなくなったら「ヘルプ」と入力してみてください。"];
  } else if ('スプレッドシート' == user_message) {
    spreadSheet = getSpreadSheet(user_id);
    reply_messages = [spreadSheet.getUrl()];
  } else if ('アイデア' == user_message) {
    try {
      spreadSheet = getSpreadSheet(user_id);
      reply_messages = getRandomIdeas(spreadSheet);
    } catch (ex) {
      Logger.log(ex);
    }
  } else if (typeof user_message === 'undefined') {
    reply_messages = ["ゴメンナサイ、文字以外の情報には対応していません。\n\n使い方が知りたいときは「ヘルプ」と入力してみてください。"];
  } else {
    addToSpreadSheet(user_id, user_message);
    reply_messages = ['アイデアが追加されました'];
  }

  var messages = reply_messages.map(function (v) {
    return {'type': 'text', 'text': v};    
  });    
  UrlFetchApp.fetch(line_endpoint, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': reply_token,
      'messages': messages,
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}
