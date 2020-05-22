#!/usr/bin/env node
import 'source-map-support/register';
import * as Cdk from '@aws-cdk/core';
import * as SecretsManager from 'aws-sdk/clients/secretsmanager';

import { PersonalStack } from '../lib/personal-stack';
import { DeployStack } from '../lib/deploy-stack';
import * as Secrets from '../lib/secrets';

// not sure if my version of ts or node supports top level await
// this still works
(async function () {
  const app = new Cdk.App();

  // Stack must be in us-east-1, because ACM certs for
  // global Cloudfront distributions can only be from IAD
  const personalStack = new PersonalStack(app, 'PersonalStack', {
    env: {
      account: '609842208353',
      region: 'us-east-1',
    },
  });

  try {
    // created the secret outside of the stack
    const githubSecret: SecretsManager.DescribeSecretResponse = await Secrets.getSecret('GithubPersonalAccessToken');
    new DeployStack(app, 'DeployStack', {
      GithubSecretArn: githubSecret.ARN as string,
      StaticAssetsBucket: personalStack.staticAssetsBucket,
      env: {
        region: 'us-east-1',
      },
    });
  } catch (error) {
    throw error;
  }

  app.synth();
})();
