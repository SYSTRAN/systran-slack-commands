// Copyright (c) 2016 SYSTRAN S.A.

var restify = require('restify');
var request = require('request');
var _ = require('lodash');

var systranApiKey = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
var commandTokenTranslate = 'yyyyyyyyyyyyyyyyyyyyyyyy';
var commandTokenDictionary = 'zzzzzzzzzzzzzzzzzzzzzzzz';

function detectLanguage(input, cb) {
  request({
    url: 'https://api-platform.systran.net/nlp/lid/detectLanguage/document',
    qs: {
      key: systranApiKey,
      format: 'text',
      input: input
    }
  } , function(err, resp, body) {
    if (err || resp.statusCode !== 200) {
      cb(err || new Error(body || 'Unable to detect language'));
      return;
    }

    try {
      body = JSON.parse(body);
    }
    catch (e) {
      cb(e);
      return;
    }

    console.log('SYSTRAN Platform', 'detectLanguage', 'response', body);

    if (body && body.detectedLanguages && body.detectedLanguages[0]) {
      cb(null, body.detectedLanguages[0].lang, body.detectedLanguages[0].confidence);
    } else {
      cb(new Error('Unable to detect language'));
    }
  });
}

function translate(input, source, target, cb) {
  var i = input.replace(/(:[a-zA-Z0-9_\-\+]+:)/g, "<dnt_insertion>$1</dnt_insertion>").replace(/(<@[a-zA-Z0-9_\-\+\.\|]+>)/g, "<dnt_insertion>$1</dnt_insertion>");

  request({
    url: 'https://api-platform.systran.net/translation/text/translate',
    qs: {
      key: systranApiKey,
      source: source || 'auto',
      target: target,
      format: 'text',
      input: i
    }
  }, function(err, resp, body) {
    if (err || resp.statusCode !== 200) {
      cb(err || new Error(body || 'Unable to translate'));
      return;
    }

    try {
      body = JSON.parse(body);
    } catch (e) {
      cb(e);
      return;
    }

    console.log('SYSTRAN Platform', 'translate', 'response', body);

    if (body && body.outputs && body.outputs[0] && body.outputs[0].output) {
      cb(null, body.outputs[0].output);
    } else if (source !== 'en' && target !== 'en' &&
               body && body.outputs && body.outputs[0] && body.outputs[0].error &&
               body.outputs[0].error.match(/No Queue defined for Route/)) {
      // Language Pair not available, pivot via English
      translate(input, source, 'en', function(err, outputEn) {
        if (err) {
          cb(err);
          return;
        }

        translate(outputEn, 'en', target, cb);
      });
    } else {
      cb(new Error('Unable to translate'));
    }
  });
}

function translationSupportedLanguages(cb) {
  request({
    url: 'https://api-platform.systran.net/translation/supportedLanguages',
    qs: {
      key: systranApiKey
    }
  }, function(err, resp, body) {
    if (err || resp.statusCode !== 200) {
      cb(err || new Error(body || 'Unable to get supported languages'));
      return;
    }

    try {
      body = JSON.parse(body);
    }
    catch (e) {
      cb(e);
      return;
    }

    cb(null, body);
  });
}

function dictionarySupportedLanguages(cb) {
  request({
    url: 'https://api-platform.systran.net/resources/dictionary/lookup/supportedLanguages',
    qs: {
      key: systranApiKey
    }
  }, function(err, resp, body) {
    if (err || resp.statusCode !== 200) {
      cb(err || new Error(body || 'Unable to get supported languages'));
      return;
    }

    try {
      body = JSON.parse(body);
    }
    catch (e) {
      cb(e);
      return;
    }

    cb(null, body);
  });
}

function dictionary(input, source, target, cb) {
  request({
    url: 'https://api-platform.systran.net/resources/dictionary/lookup',
    qs: {
      key: systranApiKey,
      source: source,
      target: target,
      input: input
    }
  }, function(err, resp, body) {
    if (err || resp.statusCode !== 200) {
      cb(err || new Error(body || 'Unable to lookup'));
      return;
    }

    try {
      body = JSON.parse(body);
    } catch (e) {
      cb(e);
      return;
    }

    console.log('SYSTRAN Platform', 'lookup', 'response', body);

    if (body && body.outputs && body.outputs[0] && body.outputs[0].output) {
      cb(null, body.outputs[0].output);
    } else {
      cb(new Error('Unable to lookup'));
    }
  });
}

var targets = [];

function helpTranslate() {
  return {
    text: '*Help:*\n' +
      '*/translate [target language: es, en, fr…] [message to translate]* (example: /translate fr How are you today?)\n' +
      '*/translate languages*  -  returns the list of available languages\n' +
      '*/translate help*  -  display the help message\n'
  };
}

function cmdTranslate(req, res, next) {
  var token = req.params.token;
  var command = req.params.command;
  var text = req.params.text;

  console.log('params', req.params);
  console.log('token', token);
  console.log('command', command);

  if (! token || token !== commandTokenTranslate) {
    res.send(401, 'Unauthorized');
    return;
  }

  console.log('text', text);

  if (! text || text === 'help') {
    res.json(helpTranslate());
  } else if (text === 'languages') {
    res.send('The available target languages are ' + targets.join(', '));
  } else if (text.length > 3 && targets.indexOf(text.substr(0, 2)) !== -1 && text[2] === ' ') {
    var targetLang = text.substr(0, 2);
    text = text.substr(3);
    console.log('Translate to', targetLang, text);

    detectLanguage(text, function(err, lang) {
      if (err) {
        console.error('Error', 'detectLanguage', err);
        res.send('Unable to translate');
        return;
      }

      if (lang === targetLang) {
        res.send(text);
        return;
      }

      translate(text, lang, targetLang, function(err, output) {
        if (err) {
          console.error('Error', 'translate', err);
          res.send('Unable to translate');
          return;
        }

        res.json({ text: '*' + lang + ':* ' + text + '\n*' + targetLang + ':* ' + output });
      });
    });
  } else {
    res.json(helpTranslate());
  }
  next();
}

var lps = [];

function helpDictionary() {
  return {
    text: '*Help:*\n' +
      '*/dictionary [source language: es en fr] [target language: es, en, fr…] [term]* (example: /dictionary en ko plane)\n' +
      '*/dictionary languages*  -  returns the list of available language pairs\n' +
      '*/dictionary help*  -  display the help message\n'
  };
}

function cmdDictionary(req, res, next) {
  var token = req.params.token;
  var command = req.params.command;
  var text = req.params.text;

  console.log('params', req.params);
  console.log('token', token);
  console.log('command', command);

  if (! token || token !== commandTokenDictionary) {
    res.send(401, 'Unauthorized');
    return;
  }

  console.log('text', text);

  if (! text || text === 'help') {
    res.json(helpDictionary());
  } else if (text === 'languages') {
    res.send('The available language pairs are ' + lps.join(', '));
  } else if (text.length > 6 && lps.indexOf(text.substr(0, 5)) !== -1 && text[5] === ' ') {
    var sourceLang = text.substr(0, 2);
    var targetLang = text.substr(3, 2);
    text = text.substr(6);
    console.log('Dictionary lookup', sourceLang, targetLang, text);

    dictionary(text, sourceLang, targetLang, function(err, output) {
      if (err) {
        console.error('Error', 'dictionary', err);
        res.send('Unable to lookup');
        return;
      }

      var j = {
        text: 'Dictionary lookup *' + sourceLang + '* *' + targetLang + '* *' +text + '*'
      };

      if (output.matches) {
        j.attachments = output.matches.map(function(m) { 
          console.log(m.source); 
          var mm = {
            title: ':large_blue_circle: ' + m.source.lemma + ' (' + m.source.pos + ')',
            mrkdwn_in: ['fields']
          };

          if (m.targets) {
            mm.fields = m.targets.map(function(t) {
              var tt = {
                title: ':small_blue_diamond: ' + t.lemma,
                value : ''
              };

              if (t.invmeanings)
                tt.value += ':arrow_right_hook: ' + t.invmeanings.join(', ') + '\n';

              if (t.expressions) {
                tt.value += t.expressions.map(function(e) { return '*' + e.source + '*: ' + e.target; }).join('\n');
              }
              return tt;
            });
          }

          if (m.other_expressions) {
            var tt = {
              title: ':small_blue_diamond: Other expressions',
              value: m.other_expressions.map(function(e) { return '*' + e.source + '*: ' + e.target; }).join('\n')
            };
            if (! mm.fields)
              mm.fields = []; 
            mm.fields.push(tt);
          }

          return mm;
        });
      }

      res.json(j);
    });
  } else {
    res.json(helpDictionary());
  }
  next();
}

var server = restify.createServer();
server.use(restify.bodyParser());
server.post('/command/translate', cmdTranslate);
server.post('/command/dictionary', cmdDictionary);

translationSupportedLanguages(function(err, data) {
  if (err) {
    console.error('Error', 'supportedLanguages', err);
    process.exit(1);
  }

  if (! data.languagePairs) {
    console.error('No language pairs');
    process.exit(1);
  }

  targets = _.uniq(_.map(data.languagePairs, 'target'));
  console.log('Translation target languages', targets.join(', '));

  dictionarySupportedLanguages(function(err, data) {
    if (err) {
      console.error('Error', 'supportedLanguages', err);
      process.exit(1);
    }

    if (! data.languagePairs) {
      console.error('No language pairs');
      process.exit(1);
    }

    lps = _.uniq(data.languagePairs.map(function(e) { return e.source + ' ' + e.target; }));
    console.log('Dictionary language pairs', lps.join(', '));

    server.listen(3000, function() {
      console.log('%s listening at %s', server.name, server.url);
    });
  });
});
