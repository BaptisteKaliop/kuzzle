function apiSteps () {
  this.When(/^I get the server timestamp$/, function(callback) {
    this.api.now()
      .then(response => {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      })
      .catch(error => callback(error));
  });

  this.Then(/^I can read the timestamp$/, function(callback) {
    if (!this.result.now || !Number.isInteger(this.result.now)) {
      return callback('Expected a timestamp result, got: ' + this.result);
    }

    callback();
  });
}

module.exports = apiSteps;
