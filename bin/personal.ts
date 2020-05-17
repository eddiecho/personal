#!/usr/bin/env node
import 'source-map-support/register';
import * as Cdk from '@aws-cdk/core';
import * as SecretsManager from 'aws-sdk/clients/secretsmanager';

import { PersonalStack } from '../lib/personal-stack';
import { DeployStack } from '../lib/deploy-stack';
import { getSecret } from '../lib/secrets';

(async function () {
  const app = new Cdk.App();
  const personalStack = new PersonalStack(app, 'PersonalStack');

  const githubSecret: SecretsManager.DescribeSecretResponse = await getSecret(
    'GithubPersonalAccessToken'
  );
  new DeployStack(app, 'DeployStack', {
    // overly strict aliasing
    GithubSecretArn: githubSecret.ARN as string,
    LambdaCode: personalStack.lambdaCode,
  });

  app.synth();
})();
