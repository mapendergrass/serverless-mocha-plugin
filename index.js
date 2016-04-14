'use strict';

/**
 * serverless-mocha-plugin
 * - a plugin for TDD with serverless
 */

const path  = require('path'),
  fs        = require('fs'),
  lambdaWrapper = require('lambda-wrapper'),
  Mocha = require('mocha'),
  chai = require('chai'),
  BbPromise = require('bluebird'); // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)

const testFolder = 'test'; // Folder used my mocha for tests

module.exports = function(S) { // Always pass in the ServerlessPlugin Class

  /**
   * Adding/Manipulating Serverless classes
   * - You can add or manipulate Serverless classes like this
   */

  S.classes.Project.newStaticMethod     = function() { console.log("A new method!"); };
  S.classes.Project.prototype.newMethod = function() { S.classes.Project.newStaticMethod(); };

  /**
   * Extending the Plugin Class
   * - Here is how you can add custom Actions and Hooks to Serverless.
   * - This class is only required if you want to add Actions and Hooks.
   */

  class PluginBoilerplate extends S.classes.Plugin {

    /**
     * Constructor
     * - Keep this and don't touch it unless you know what you're doing.
     */

    constructor() {
      super();
      this.name = 'myPlugin'; // Define your plugin's name
    }

    /**
     * Register Actions
     * - function mocha-create  
     */

    registerActions() {

      S.addAction(this._createAction.bind(this), {
        handler:       'customAction',
        description:   'Create mocha test for function',
        context:       'function',
        contextAction: 'mocha-create',
        options:       [{ // These must be specified in the CLI like this "-option true" or "-o true"
        }],
        parameters: [ // Use paths when you multiple values need to be input (like an array).  Input looks like this: "serverless custom run module1/function1 module1/function2 module1/function3.  Serverless will automatically turn this into an array and attach it to evt.options within your plugin
          {
            parameter: 'paths',
            description: 'Path to function to test. If not defined, test all functions.',
            position: '0->' // Can be: 0, 0-2, 0->  This tells Serverless which params are which.  3-> Means that number and infinite values after it.
          }
        ]
      });
      
      S.addAction(this._runAction.bind(this), {
        handler:       'customAction',
        description:   'Create mocha test for function',
        context:       'function',
        contextAction: 'mocha-run',
        options:       [{ // These must be specified in the CLI like this "-option true" or "-o true"
        }],
        parameters: [ // Use paths when you multiple values need to be input (like an array).  Input looks like this: "serverless custom run module1/function1 module1/function2 module1/function3.  Serverless will automatically turn this into an array and attach it to evt.options within your plugin
          {
            parameter: 'paths',
            description: 'Path to function to test. If not defined, test all functions.',
            position: '0->' // Can be: 0, 0-2, 0->  This tells Serverless which params are which.  3-> Means that number and infinite values after it.
          }
        ]
      });
      
      return BbPromise.resolve();
    }

    /**
     * Register Hooks
     * -  function create (post) creates mocha test file
     */

    registerHooks() {
      S.addHook(this._hookPostFuncCreate.bind(this), {
        action: 'functionCreate',
        event:  'post'
      });

      return BbPromise.resolve();
    }

    /**
     * Custom action serverless function mocha-create functioName
     */

    _createAction(evt) {
      return createTest(evt.options.paths[0]);
    }
    
       /**
     * Custom action serverless function mocha-create functioName
     */

    _runAction(evt) {
      return new BbPromise(function(resolve, reject) {
          let funcName = evt.options.paths;
          let mocha = new Mocha();
          getFilePaths(evt.options.paths)
          .then(function(paths) {
              paths.forEach(function(path,idx) {
                  mocha.addFile(path);
              })
              mocha.run();
          }, function(error) {
              return reject(error);
          });
      });
    }
    /**
     * Hook for creating the mocha test placeholder after function creation
     */

    _hookPostFuncCreate(evt) {
      // TODO: only run with runtime node4.3
      if (evt.options.runtime != 'nodejs4.3') {
        console.log(evt.options.runtime);
        return;
      }    
      return createTest(evt.options.path);
    }
  }
  
  // Create the test folder
  function createTestFolder() {
      return new BbPromise(function(resolve, reject) {

        fs.exists(testFolder, function(exists) {
            if (exists) {
                return resolve(testFolder);
            }
            fs.mkdir(testFolder, function(err) {
                if (err) {
                    return reject(err);
                }
                return resolve(testFolder);
            })        
        })
      });
  }
  
  // Create the test file (and test folder)
  
  function createTest(funcName) {
    return createTestFolder().then(function(testFolder) {
      return new BbPromise(function(resolve, reject) {
        let funcFilePath = testFilePath(funcName);
        
        fs.exists(funcFilePath, function (exists) {
           if (exists) {
               return reject(new Error(`File ${funcFilePath} already exists`));
           } 
           fs.writeFile(funcFilePath, newTestFile(funcName), function(err) {
               if (err) {
                   return reject(new Error(`Creating file ${funcFilePath} failed: ${err}`));
               }
               console.log(`serverless-mocha-plugin: created ${funcFilePath}`);
               return resolve(funcFilePath);
           })    
        });
      });
    });
  }
  
  // getTestFiles. If no functions provided, returns all files
  function getFilePaths(funcs) {
    return new BbPromise(function(resolve, reject) {
        var paths = [];
        
        if (funcs && (funcs.length > 0)) {
            funcs.forEach(function(val, idx) {
                paths.push(testFilePath(val));
            });
            return resolve(paths);
        } 
        // No funcs provided, list all test files
        fs.readdirSync(testFolder).filter(function(file){
          // Only keep the .js files
          return file.substr(-3) === '.js';
        }).forEach(function(file) {
            paths.push(path.join(testFolder, file));
        });   
        return resolve(paths);
    });
  };
  
  // Returns the path to a function's test file
  function testFilePath(funcName) {
      return path.join(testFolder, `${funcName.replace(/\//g, '_')}.js`);
  }
  
  function newTestFile(funcName) {
      return `// tests for ${funcName}
// Generated by serverless-mocha-plugin

var mod = require('../${funcName}/handler.js');
var mochaPlugin = require('serverless-mocha-plugin');
var wrapper = mochaPlugin.lambdaWrapper;
var expect = mochaPlugin.chai.expect; 

wrapper.init(mod);

describe('${funcName}', function() {
  it('implement tests here', function(done) {
    wrapper.run({}, function(err, response) {    
      done('no tests implemented'); 
    });
  });
});
`;
      
  }
  // Export Plugin Class
  return PluginBoilerplate;
};

module.exports.lambdaWrapper = lambdaWrapper;
module.exports.chai = chai
