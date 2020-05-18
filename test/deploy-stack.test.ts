import { expect, countResources } from '@aws-cdk/assert';
import * as Lambda from '@aws-cdk/aws-lambda';
import * as Cdk from '@aws-cdk/core';

import * as Deploy from '../lib/deploy-stack';

describe('Deploy Stack', () => {
  const app = new Cdk.App();

  const mockStack = new Cdk.Stack();
  const code = Lambda.Code.fromCfnParameters();
  const lambda = new Lambda.Function(mockStack, 'MockLambda', {
    code,
    handler: 'index.handler',
    runtime: Lambda.Runtime.NODEJS_12_X,
  });

  const props: Deploy.DeployStackProps = {
    GithubSecretArn: 'arn:aws:secretsmanager:us-west-2:123412341234:secret:GithubPersonalAccessToken',
    LambdaCode: code,
  };
  const stack = new Deploy.DeployStack(app, 'DeployTestStack', props);

  test('renders correctly', () => {
    expect(stack).to(countResources('AWS::CodePipeline::Pipeline', 1));
  });
});
