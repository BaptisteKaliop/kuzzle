var
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Role = require.main.require('lib/api/core/models/security/role'),
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test: repositories/roleRepository', () => {
  var
    kuzzle,
    ObjectConstructor,
    forwardedObject,
    persistedObject1,
    persistedObject2;

  /**
   * @constructor
   */
  ObjectConstructor = function() {
    this.type = 'testObject';
  };

  persistedObject1 = new ObjectConstructor();
  persistedObject1._id = 'persisted1';

  persistedObject2 = new ObjectConstructor();
  persistedObject2._id = 'persisted2';

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(()=> kuzzle.repositories.init());
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadRoles', () => {
    it('should return an empty array when loading some non-existing roles', () => {
      sandbox.stub(kuzzle.internalEngine, 'mget').returns(Promise.resolve({hits: [{_id: 'idontexist', found: false}]}));
      return kuzzle.repositories.role.loadRoles(['idontexist'])
        .then(result => {
          should(result).be.an.Array();
          should(result).be.empty();
        });
    });

    it('should reject the promise if some error occurs fetching data from the DB', () => {
      sandbox.stub(kuzzle.repositories.role, 'loadMultiFromDatabase').returns(Promise.reject(new InternalError('Error')));
      return should(kuzzle.repositories.role.loadRoles([-999, -998])).be.rejectedWith(InternalError);
    });

    it('should retrieve some persisted roles', () => {
      sandbox.stub(kuzzle.internalEngine, 'mget').returns(Promise.resolve({
        hits: [{_id: 'persisted1', found: true, _source: persistedObject1},
              {_id: 'persisted2', found: true, _source: persistedObject2}]
      }));
      return kuzzle.repositories.role.loadRoles(['persisted1', 'persisted2'])
        .then(results => {
          should(results).be.an.Array().and.have.length(2);
          results.forEach(result => {
            should(result).be.an.instanceOf(Role);
            should(result._id).be.oneOf(['persisted1', 'persisted2']);
          });
        });
    });

    it('should retrieve the default roles', () => {
      sandbox.stub(kuzzle.internalEngine, 'mget').returns(Promise.resolve({
        hits: [{_id: 'anonymous', found: true, _source: {}}]
      }));
      return kuzzle.repositories.role.loadRoles(['anonymous'])
        .then(results =>{
          should(results).be.an.Array().and.have.length(1);
          should(results[0]).be.an.instanceOf(Role);
          should(results[0]._id).be.exactly('anonymous');
        });
    });

    it('should retrieve only the roles that exist', () => {
      sandbox.stub(kuzzle.internalEngine, 'mget').returns(Promise.resolve({
        hits: [{_id: 'anonymous', found: true, _source: {}}]
      }));
      return kuzzle.repositories.role.loadRoles(['anonymous', 'idontexist'])
        .then(results => {
          should(results).be.an.Array().and.have.length(1);
          should(results[0]).be.an.instanceOf(Role);
          should(results[0]._id).be.exactly('anonymous');
        });
    });
  });

  describe('#loadRole', () => {
    it('should return a bad request error when no _id is provided', () => {
      return should(kuzzle.repositories.role.loadRole({})).rejectedWith(BadRequestError);
    });

    it('should load the role directly from memory if it\'s in memory', () => {
      sandbox.stub(kuzzle.repositories.role, 'roles', {roleId : {myRole : {}}});
      sandbox.stub(kuzzle.repositories.role, 'loadOneFromDatabase').returns(Promise.resolve());

      return kuzzle.repositories.role.loadRole('roleId')
        .then((role) => {
          should(kuzzle.repositories.role.loadOneFromDatabase.called).be.false();
          should(role).have.property('myRole');
        });
    });

    it('should load the role directly from DB if it\'s not in memory', () => {
      sandbox.stub(kuzzle.repositories.role, 'roles', {otherRoleId : {myRole : {}}});
      sandbox.stub(kuzzle.repositories.role, 'loadOneFromDatabase').returns(Promise.resolve({myRole : {}}));

      return kuzzle.repositories.role.loadRole('roleId')
        .then((role) => {
          should(kuzzle.repositories.role.loadOneFromDatabase.calledOnce).be.true();
          should(role).have.property('myRole');
        });
    });
  });

  describe('#searchRole', () => {
    it('should call repository search without query and with parameters from requestObject', () => {
      var
        savedQuery,
        savedFrom,
        savedSize;

      sandbox.stub(kuzzle.repositories.role, 'search', (query, from, size) => {
        savedQuery = query;
        savedFrom = from;
        savedSize = size;

        return Promise.resolve();
      });

      return kuzzle.repositories.role.searchRole(new RequestObject({body: {from: 1, size: 3}}))
        .then(() => {
          should(savedQuery).be.eql({query: {}});
          should(savedFrom).be.eql(1);
          should(savedSize).be.eql(3);
        });
    });

    it('should construct a correct query according to controllers', () => {
      var
        savedQuery;

      sandbox.stub(kuzzle.repositories.role, 'search', (query) => {
        savedQuery = query;

        return Promise.resolve();
      });

      return kuzzle.repositories.role.searchRole(new RequestObject({body: {controllers: ['test']}}))
        .then(() => {
          should(savedQuery).be.eql({
            query: {
              bool: {
                should: [
                  // specific controller name provided
                  {exists: {field: 'controllers.test'}},
                  // default filter
                  {exists: {field: 'controllers.*'}}
                ]
              }
            }
          });
        });
    });
  });

  describe('#deleteRole', () => {
    it('should reject if there is no _id', () => {
      return should(kuzzle.repositories.role.deleteRole({})).rejectedWith(BadRequestError);
    });

    it('should reject if a profile uses the role about to be deleted', () => {
      sandbox.stub(kuzzle.internalEngine, 'search').returns(Promise.resolve({total: 1, hits: ['test']}));

      return should(kuzzle.repositories.role.deleteRole({_id: 'test'})).rejectedWith(BadRequestError);
    });

    it('should call deleteFromDatabase and remove the role from memory', () => {
      sandbox.stub(kuzzle.repositories.role, 'roles', {myRole : {}});

      sandbox.stub(kuzzle.repositories.role, 'deleteFromDatabase').returns(Promise.resolve());
      sandbox.stub(kuzzle.repositories.profile, 'search').returns(Promise.resolve({total: 0}));

      return kuzzle.repositories.role.deleteRole({_id: 'myRole'})
        .then(() => {
          should(kuzzle.repositories.role.roles).be.eql({});
          should(kuzzle.repositories.role.deleteFromDatabase.calledOnce).be.true();
        });
    });
  });

  describe('#getRoleFromRequestObject', () => {
    it('should build a valid role object', () => {
      var
        controllers = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        requestObject = new RequestObject({
          collection: 'collection',
          controller: 'controller',
          action: 'action',
          body: {
            _id: 'roleId',
            controllers: controllers
          }
        }),
        role;

      role = kuzzle.repositories.role.getRoleFromRequestObject(requestObject);

      should(role._id).be.exactly('roleId');
      should(role.controllers).be.eql(controllers);
    });
  });

  describe('#validateAndSaveRole', () => {
    it('should reject the promise if no id is defined', () => {
      var role = new Role();

      return should(kuzzle.repositories.role.validateAndSaveRole(role)).be.rejectedWith(BadRequestError);
    });

    it('should reject the promise if an invalid role is given', () => {
      var role = new Role();
      role._id = 'test';

      return should(kuzzle.repositories.role.validateAndSaveRole(role)).be.rejectedWith(BadRequestError);
    });

    it('should persist the role to the database when ok', () => {
      var
        controllers = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        role = new Role();
      role._id = 'test';
      role.controllers = controllers;

      sandbox.stub(kuzzle.repositories.role.databaseEngine, 'createOrReplace', (type, id, content) => {
        forwardedObject = {type, id, content};
        return Promise.resolve({});
      });

      return kuzzle.repositories.role.validateAndSaveRole(role)
        .then(() => {
          should(forwardedObject.id).be.exactly('test');
          should(forwardedObject.content.controllers).be.eql(controllers);
          should(forwardedObject.type).be.eql('roles');
        });
    });
  });
});
