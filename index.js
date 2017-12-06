const Promise = require('bluebird')
const AWS = require('aws-sdk')

AWS.config.setPromisesDependency(Promise)
const sts = new AWS.STS({ apiVersion: '2011-06-15' })

const duration = 3600

function DDBFactory (region) {
  this.region = region || 'eu-central-1'
  this.ddbcc = {}
}

DDBFactory.prototype.get = function get (tenant) {
  const now = new Date().getTime()

  // check if credentials do not exist or are expired
  if (!this.ddbcc[tenant] ||
    (this.ddbcc[tenant].acquired + duration < now - (duration / 10))) {
    console.log(`No cached credentials for tenant ${tenant}.`)

    const params = {
      RoleArn: `arn:aws:iam::947257169342:role/tenant-${tenant}`,
      RoleSessionName: `${tenant}-${now}`,
      DurationSeconds: duration
    }

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
}

module.exports = DDBFactory
