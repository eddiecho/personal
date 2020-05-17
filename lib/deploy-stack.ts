import * as CodeBuild from '@aws-cdk/aws-codebuild';
import * as CodePipeline from '@aws-cdk/aws-codepipeline';
import * as CodePipelineActions from '@aws-cdk/aws-codepipeline-actions';
import * as Iam from '@aws-cdk/aws-iam';
import * as Lambda from '@aws-cdk/aws-lambda';
import * as SecretsManager from '@aws-cdk/aws-secretsmanager';
import { App, Arn, Stack, StackProps } from '@aws-cdk/core';

export interface DeployStackProps extends StackProps {
  readonly GithubSecretArn: string;
  readonly LambdaCode: Lambda.CfnParametersCode;
}

export class DeployStack extends Stack {
  constructor(app: App, id: string, props: DeployStackProps) {
    super(app, id, props);

    const cdkBuild = new CodeBuild.PipelineProject(this, 'CdkBuild', {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: 'npm install',
          },
          pre_build: {
            commands: 'npm run test',
          },
          build: {
            commands: ['npm run build', 'npm run cdk synth -- -o dist'],
          },
        },
        artifacts: {
          'base-directory': 'dist',
          files: ['PersonalStack.template.json', 'DeployStack.template.json'],
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_2_0,
      },
    });

    const githubSecretArn = Arn.format(
      {
        resource: 'secret',
        service: 'secretsmanager',
        resourceName: 'GithubPersonalAccessToken*',
        sep: ':',
      },
      this
    );
    const additionalCodeBuildPerms = new Iam.PolicyStatement({
      actions: ['secretsmanager:DescribeSecret'],
      effect: Iam.Effect.ALLOW,
      resources: [githubSecretArn],
    });
    cdkBuild.addToRolePolicy(additionalCodeBuildPerms);

    const lambdaBuild = new CodeBuild.PipelineProject(this, 'LambdaBuild', {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['cd lambda', 'npm install'],
          },
          build: {
            commands: 'npm run build',
          },
        },
        artifacts: {
          'base-directory': 'lambda',
          files: ['index.js', 'node_modules/**/*'],
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_2_0,
      },
    });

    const sourceAuth = SecretsManager.Secret.fromSecretAttributes(
      this,
      'GithubSecret',
      {
        secretArn: props.GithubSecretArn,
      }
    ).secretValueFromJson('OAuth');

    const sourceOutput = new CodePipeline.Artifact();
    const cdkBuildOutput = new CodePipeline.Artifact('CdkBuildOutput');
    const lambdaBuildOutput = new CodePipeline.Artifact('LambdaBuildOutput');
    new CodePipeline.Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new CodePipelineActions.GitHubSourceAction({
              actionName: 'GithubSource',
              output: sourceOutput,
              repo: 'personal',
              branch: 'master',
              owner: 'eddiecho',
              oauthToken: sourceAuth,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new CodePipelineActions.CodeBuildAction({
              actionName: 'LambdaBuild',
              project: lambdaBuild,
              input: sourceOutput,
              outputs: [lambdaBuildOutput],
            }),
            new CodePipelineActions.CodeBuildAction({
              actionName: 'CDKBuild',
              project: cdkBuild,
              input: sourceOutput,
              outputs: [cdkBuildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new CodePipelineActions.CloudFormationCreateUpdateStackAction({
              actionName: 'LambdaCfnDeploy',
              templatePath: cdkBuildOutput.atPath(
                'PersonalStack.template.json'
              ),
              stackName: 'PersonalStack',
              adminPermissions: true,
              parameterOverrides: {
                ...props.LambdaCode.assign(lambdaBuildOutput.s3Location),
              },
              extraInputs: [lambdaBuildOutput],
            }),
          ],
        },
        {
          // self mutation prevents changes from being pushed forward if pipeline definition changes
          stageName: 'Self-Mutate',
          actions: [
            new CodePipelineActions.CloudFormationCreateUpdateStackAction({
              actionName: 'CodePipelineDeploy',
              templatePath: cdkBuildOutput.atPath('DeployStack.template.json'),
              stackName: 'DeployStack',
              adminPermissions: true,
            }),
          ],
        },
      ],
    });
  }
}
