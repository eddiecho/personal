import { Construct, Stack, StackProps } from '@aws-cdk/core';
import * as Lambda from '@aws-cdk/aws-lambda';
import * as CodeDeploy from '@aws-cdk/aws-codedeploy';

import { StaticSite } from './static-site';

export class PersonalStack extends Stack {
  public readonly lambdaCode: Lambda.CfnParametersCode;
  private static LAMBDA_NAME: string = 'TestLambda';

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.lambdaCode = Lambda.Code.fromCfnParameters();
    this.renderUnnecessaryLambda();

    new StaticSite(this, 'StaticSite', {
      domainName: 'eddiecho.io',
      siteSubDomain: 'www',
    });
  }

  // TODO - personal stack doesn't actually need a Lambda (for now)
  private renderUnnecessaryLambda = () => {
    const func = new Lambda.Function(this, PersonalStack.LAMBDA_NAME, {
      code: this.lambdaCode,
      handler: 'index.handler',
      runtime: Lambda.Runtime.NODEJS_12_X,
    });
    const version = func.addVersion(new Date().toISOString());
    const alias = new Lambda.Alias(this, `${PersonalStack.LAMBDA_NAME}Alias`, {
      aliasName: 'test',
      version,
    });

    new CodeDeploy.LambdaDeploymentGroup(this, `${PersonalStack.LAMBDA_NAME}DeploymentGroup`, {
      alias,
      deploymentConfig: CodeDeploy.LambdaDeploymentConfig.ALL_AT_ONCE,
    });
  };
}
