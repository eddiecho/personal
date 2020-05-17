#!/usr/bin/env node
import 'source-map-support/register';
import * as Cdk from '@aws-cdk/core';
import { AWSError } from 'aws-sdk';
import * as SecretsManager from 'aws-sdk/clients/secretsmanager';

import { PersonalStack } from '../lib/personal-stack';
import { DeployStack } from '../lib/deploy-stack';
import * as Secrets from '../lib/secrets';

(async function () {
  const app = new Cdk.App();
  const personalStack = new PersonalStack(app, 'PersonalStack');

  try {
    const githubSecret: SecretsManager.DescribeSecretResponse = await Secrets.getSecret(
      'GithubPersonalAccessToken'
    );
    new DeployStack(app, 'DeployStack', {
      // overly strict aliasing
      GithubSecretArn: githubSecret.ARN as string,
      LambdaCode: personalStack.lambdaCode,
    });
  } catch (error) {
    if (error instanceof AWSError) {
      throw error;
    }
  }

  app.synth();
})();
