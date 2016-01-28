# SYSTRAN Slack Commands

## Create custom commands to handle translation and dictionary lookup in your Slack channels.

You can create custom commands to handle translation and dictionary lookup in your Slack channels with [SYSTRAN Platform](https://platform.systran.net).

## Prerequisites and configuration

### SYSTRAN Platform API Key

Translations and dictionary lookup are performed with the [SYSTRAN Platform](https://platform.systran.net) [REST Translation API](https://platform.systran.net/reference/translation) and [REST Resource Management API](https://platform.systran.net/reference/resources). To use it, You need to get a valid API key from [SYSTRAN Platform here](https://platform.systran.net).
Then set it in the `systranApiKey` variable in `systran-slack-commands.js`.

### Custom commands creation

You need to [create a custom command](https://my.slack.com/services/new/slash-commands) and to get a command  token.
Then set it in the `commandTokenTranslate` or `commandTokenDictionary` variable in `systran-slack-commands.js`. You also need to set the URL of the command according to the URL of your custom commands server.

## Start the Slack custom commands server

```shell
$ npm start
```
