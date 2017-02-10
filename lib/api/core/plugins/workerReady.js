var
  PluginContext = require('./pluginContext'),
  config = {},
  kuzzleConfig = {},
  plugin = null;

module.exports = function ready () {
  process.on('message', packet => {
    /** @type {{data: {name: String, path:String}}} packet */

    if (packet.topic === 'initialize') {
      try {
        plugin = new (require(packet.data.path))();

        kuzzleConfig = packet.data.kuzzleConfig;
        config = packet.data.config;

        plugin.init(config, new PluginContext({config: kuzzleConfig}));
        process.send({
          type: 'initialized',
          data: {
            events: Object.keys(plugin.hooks)
          }
        });
      }
      catch (e) {
        /*eslint-disable no-console */
        console.error(`ERROR: Unable to initialize worker plugin: ${e.message}`, e.stack);
        /*eslint-enable no-console */
      }
    }

    if (packet.topic === 'trigger' && plugin.hooks[packet.data.event]) {
      if (Array.isArray(plugin.hooks[packet.data.event])) {
        plugin.hooks[packet.data.event]
          .filter(target => typeof plugin[target] === 'function')
          .forEach(func => plugin[func](packet.data.message, packet.data.event));
      }
      else if (typeof plugin[plugin.hooks[packet.data.event]] === 'function') {
        plugin[plugin.hooks[packet.data.event]](packet.data.message, packet.data.event);
      }
    }
  });

  process.send({
    type: 'ready',
    data: {}
  });
};
