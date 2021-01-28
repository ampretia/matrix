'use strict'

/*
 * This example demonstrates computing fact values at runtime, and leveraging the 'path' feature
 * to select object properties returned by facts
 *
 * Usage:
 *   node ./examples/03-dynamic-facts.js
 *
 * For detailed output:
 *   DEBUG=json-rules-engine node ./examples/03-dynamic-facts.js
 */

require('colors')
const { Engine } = require('json-rules-engine')
const semver = require('semver');

/**
 * Setup a new engine
 */
const engine = new Engine()

engine.addOperator('semvermatch', (fact,value) =>{
  let version = fact;
  let range = value;
  let match =  semver.satisfies(version,range);
  
  return match;
})

const nodeJSChaincodeCompatible = {
  conditions: {
    any: [
      {
        all:
          [
            {
              fact: 'nodejs-runtime',
              operator: 'semvermatch',
              value: '^12.2.0',
              path: '$.version'
            },
            {
              any: [
                {
                  fact: 'chaincode-library',
                  operator: 'semvermatch',
                  value: '^1.4.0',
                  path: '$.version'
                },
                {
                  fact: 'chaincode-library',
                  operator: 'semvermatch',
                  value: '^2.0.0',
                  path: '$.version'
                }

              ]
            }

          ]
      },
      {
        all:
          [
            {
              fact: 'nodejs-runtime',
              operator: 'semvermatch',
              value: '^8.0.0',
              path: '$.version'
            },
            {
              any: [
                {
                  fact: 'chaincode-library',
                  operator: 'semvermatch',
                  value: '^1.4.0',
                  path: '$.version'
                }
              ]
            }
          ]
      }
    ]
  },
  event: {
    type: 'chaincode-node',
    params: {
      message: 'Supported NodeJS and Chaincode Library combination'
    }
  }
}
engine.addRule(nodeJSChaincodeCompatible)


// The version of the nodejs runtime can be determined by the
// level of fabric; unless it is overridden.
engine.addFact('nodeenv', (params, almanac) => {
  return almanac.factValue('fabric')
    .then(fabric => {
      if (semver.satisfies(fabric.version,'^2.0.0')) {
        return { version: '2.0.0', inferred:true }
      } else if  (semver.satisfies(fabric.version,'^1.4.4')) {
        return { version: '1.4.4' , inferred:true}
      } else {
        return {}
      }
    })
})

engine.addFact('nodejs-runtime', (params, almanac) => {
  return almanac.factValue('nodeenv')
    .then(nodeenv => {
      if (semver.satisfies(nodeenv.version,'^2.0.0')) {
        return { version: '12.2.0', inferred:true }
      } else if (semver.satisfies(nodeenv.version,'^1.4.0')) {
        return { version: '8.9.6' , inferred:true}
      } else {
        return {}
      }
    })
}, { event: { type:'added nodeversions'} })





function render(message, ruleResult) {
 
  // if rule succeeded, render success message
  if (ruleResult.result) {
    return console.log(`${message}`.green)
  }
  // const detail = renderCondition(ruleResult.conditions);
  console.log(`${message}`.red)
}

const renderCondition = (condition) => {
  if (condition.operator !== 'any' && condition.operator !== 'all') {
    if (!condition.result)
      return renderOperator(condition);
    else 
      return '';
  }


  return condition[condition.operator].map(c => renderCondition(c)).join(' ');
}
const renderOperator = (operator) => {
  return `${operator.fact} at ${operator.factResult} is ${operator.result?'':'NOT'} compatible with ${operator.value} \n`
}



const summaryFacts = async (almanac) =>{
  let fabric = await almanac.factValue('fabric');
  let nodeenv = await almanac.factValue('nodeenv')
  let nodejs_runtime = await almanac.factValue('nodejs-runtime')
  let chaincode_library = await almanac.factValue('chaincode-library')

  let summary = `Fabric=${fabric.version} ${fabric.inferred?'[inferred]':''} `;
  summary += `NodeEnv=${nodeenv.version} ${nodeenv.inferred?'[inferred]':''} `;
  summary += `NodeJS=${nodejs_runtime.version} ${nodejs_runtime.inferred?'[inferred]':''} `;
  summary += `ChaincodeLib=${chaincode_library.version} ${chaincode_library.inferred?'[inferred]':''} `
 
  return summary;
}


/**
 * On success, retrieve the student's username and print rule name for display purposes, and render
 */
engine.on('success', async (event, almanac, ruleResult) => {
 render(`Success: ${await summaryFacts(almanac)} \n`, ruleResult);
})

/**
 * On failure, retrieve the student's username and print rule name for display purposes, and render
 */
engine.on('failure', async (event, almanac, ruleResult) => {
  render(`Failure: ${await summaryFacts(almanac)} \n`, ruleResult);
})



const main = async () => {

  engine.addFact('fabric', { version: '1.4.4' });
  // assertion that this is the runtime I am using
  // engine.addFact('nodejs-runtime', { version: '12.2.0' });
  engine.addFact('chaincode-library', { version: '2.0.0' });
  await engine.run();

  // assertion that this is the runtime I am using
  // engine.addFact('nodejs-runtime', { version: '12.2.0' });
  engine.addFact('chaincode-library', { version: '1.4.0' });
  await engine.run();
}




main().catch((e) => {
  console.error(e);
});
