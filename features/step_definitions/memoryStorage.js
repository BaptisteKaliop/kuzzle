const
  Promise = require('bluebird'),
  should = require('should');

function apiSteps () {

  this.When(/^I call the (.*?) method of the memory storage with arguments$/, function (command, args) {
    let realArgs;

    if (args && args !== '') {
      try{
        realArgs = JSON.parse(args.replace(/#prefix#/g, this.idPrefix));
      }
      catch(err) {
        return Promise.reject(err);
      }
    }

    return this.api.callMemoryStorage(command, realArgs)
      .then(response => {
        if (response.error) {
          return Promise.reject(response.error);
        }

        this.memoryStorageResult = response;

        return response;
      });
  });

  this.Then(/^The (sorted )?ms result should match the (regex|json) (.*?)$/, function (sorted, type, pattern, callback) {
    let
      regex,
      val = this.memoryStorageResult.result;

    if (sorted && Array.isArray(val)) {
      val = val.sort();
    }

    if (type === 'regex') {
      regex = new RegExp(pattern.replace(/#prefix#/g, this.idPrefix));
      if (regex.test(val.toString())) {
        callback();
      }
      else {
        callback(new Error('pattern mismatch: \n' + JSON.stringify(val) + '\n does not match \n' + regex));
      }
    }

    if (type === 'json') {
      pattern = pattern.replace(/#prefix#/g, this.idPrefix);

      try {
        should(JSON.parse(pattern)).be.eql(val);
        callback();
      }
      catch(err) {
        return callback(new Error('Error: ' + JSON.stringify(val) + ' does not match ' + pattern));
      }
    }
  });
}

module.exports = apiSteps;
