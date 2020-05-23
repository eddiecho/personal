import { expect, countResources } from '@aws-cdk/assert';
import * as Cdk from '@aws-cdk/core';
import * as S3 from '@aws-cdk/aws-s3';

import * as Deploy from '../lib/deploy-stack';

describe('Deploy Stack', () => {
  const app = new Cdk.App();

  const props: Deploy.DeployStackProps = {
    GithubSecretArn: 'arn:aws:secretsmanager:us-west-2:123412341234:secret:GithubPersonalAccessToken',
    StaticAssetsBucket: 'mock-test-bucket-name',
  };
  const stack = new Deploy.DeployStack(app, 'DeployTestStack', props);

  test('renders correctly', () => {
    expect(stack).to(countResources('AWS::CodePipeline::Pipeline', 1));
  });
});
