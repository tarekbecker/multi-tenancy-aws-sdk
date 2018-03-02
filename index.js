const Promise = require('bluebird')
const AWS = require('aws-sdk')
const lambda = require('lambda-helper')

AWS.config.setPromisesDependency(Promise)
const sts = new AWS.STS({ apiVersion: '2011-06-15' })

const duration = 3600

function DDBFactory (region) {
  this.region = region || process.env.AWS_REGION
  this.ddbcc = {}
}

DDBFactory.prototype.get = function get (tenant) {
  return lambda.tenantInfo()
    .then(config => config[tenant])
    .then(tenantInfo => {
      const now = new Date().getTime()

      // check if credentials do not exist or are expired
      if (!this.ddbcc[tenant] ||
        (this.ddbcc[tenant].acquired + duration < now - (duration / 10))) {
        console.log(`No cached credentials for tenant ${tenant}.`)

        const params = {
          RoleArn: tenantInfo.role,
          RoleSessionName: `${tenant}-${now}`,
          DurationSeconds: duration
        }

        console.log('%j', params);

        this.ddbcc[tenant] = {
          acquired: now,
          promise: sts
            .assumeRole(params)
            .promise()
            .then((data) => {
              const {
                Credentials: {
                  AccessKeyId,
                  SecretAccessKey,
                  SessionToken
                }
              } = data
              return new AWS.DynamoDB({
                accessKeyId: AccessKeyId,
                secretAccessKey: SecretAccessKey,
                sessionToken: SessionToken,
                apiVersion: '2012-08-10',
                region: this.region
              })
            })
        }
      }
      return this.ddbcc[tenant].promise
    })
}

module.exports = DDBFactory
