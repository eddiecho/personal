import * as CodeBuild from '@aws-cdk/aws-codebuild';
import * as CodePipeline from '@aws-cdk/aws-codepipeline';
import * as CodePipelineActions from '@aws-cdk/aws-codepipeline-actions';
import * as Iam from '@aws-cdk/aws-iam';
import * as Kms from '@aws-cdk/aws-kms';
import * as S3 from '@aws-cdk/aws-s3';
import * as SecretsManager from '@aws-cdk/aws-secretsmanager';
import { App, Duration, Stack, StackProps } from '@aws-cdk/core';

export interface DeployStackProps extends StackProps {
  readonly GithubSecretArn: string;
  readonly StaticAssetsBucket: string;
}

export class DeployStack extends Stack {
  private props: DeployStackProps;
  private cdkRole: Iam.Role;

  constructor(app: App, id: string, props: DeployStackProps) {
    super(app, id, props);

    this.props = props;
    this.cdkRole = this.renderStackDeployRole();

    new CodePipeline.Pipeline(this, 'Pipeline', {
      artifactBucket: this.renderArtifactBucket(),
      restartExecutionOnUpdate: true,
      stages: this.renderPipelineStages(),
    });
  }

  private renderStackDeployRole = (): Iam.Role => {
    const policy = new Iam.PolicyStatement();
    policy.addActions('*');
    policy.addResources('*');
    // I'm going to give CFN admin perms anyway
    // Yes, it's bad practice, but it's way too annoying
    // trying to enumerate all the things you create
    // Especially hard since CDK creates some random stuff I don't know about
    const role = new Iam.Role(this, 'CdkCodeBuildRole', {
      assumedBy: new Iam.ServicePrincipal('cloudformation.amazonaws.com'),
    });
    role.addToPolicy(policy);
    return role;
  };

  private renderStackDeploy = (stackName: string): CodeBuild.PipelineProject => {
    // I have no idea how to set up PersonalStack with CFN, since it uses the
    // DNSValidatedCert, which requires assets managed by CDK
    // Because of this, just use CodeBuild instead of CFN directly.
    // TODO - remove DNSValidatedCert, use CFN directly so I can remove this trash
    const project = new CodeBuild.PipelineProject(this, `${stackName}Deploy`, {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['cd cdk', 'npm install'],
          },
          pre_build: {
            commands: ['npm run release'],
          },
          build: {
            commands: [`npm run cdk deploy ${stackName} -- --require-approval never -r ${this.cdkRole.roleArn}`],
          },
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_4_0,
      },
    });

    const policy = new Iam.PolicyStatement();
    policy.addActions('secretsmanager:DescribeSecret');
    policy.addResources(this.props.GithubSecretArn);
    policy.addActions('cloudformation:*');
    policy.addResources('*');
    policy.addActions('s3:*');
    policy.addResources('arn:aws:s3:::cdktoolkit-stagingbucket-*');
    policy.addActions('iam:PassRole');
    policy.addResources(this.cdkRole.roleArn);

    project.addToRolePolicy(policy);
    return project;
  };

  private renderLambdaBuild = (): CodeBuild.PipelineProject => {
    return new CodeBuild.PipelineProject(this, 'LambdaBuild', {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['cd lambda'],
          },
          build: {
            commands: 'ls',
          },
        },
        artifacts: {
          'base-directory': 'lambda',
          files: ['index.js'],
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_4_0,
      },
    });
  };

  private renderArtifactBucket = (): S3.Bucket => {
    const artifactBucketKey = new Kms.Key(this, 'ArtifactEncryptionBucketKey', {
      enableKeyRotation: true,
    });

    return new S3.Bucket(this, 'ArtifactBucket', {
      bucketName: 'pipeline-artifact-bucket-609842208353',
      blockPublicAccess: S3.BlockPublicAccess.BLOCK_ALL,
      encryption: S3.BucketEncryption.KMS,
      encryptionKey: artifactBucketKey,
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(7),
          prefix: 'CdkBuild',
        },
        {
          enabled: true,
          expiration: Duration.days(7),
          prefix: 'Lambda',
        },
        {
          enabled: true,
          expiration: Duration.days(7),
          prefix: 'Artifact',
        },
      ],
    });
  };

  private renderReactApp = (): CodeBuild.PipelineProject => {
    return new CodeBuild.PipelineProject(this, 'ReactAppBuild', {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['cd site', 'npm install'],
          },
          pre_build: {
            commands: ['npm run test'],
          },
          build: {
            commands: ['npm run build'],
          },
        },
        artifacts: {
          'base-directory': 'site/build',
          files: ['**/*'],
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_4_0,
      },
    });
  };

  private renderPipelineStages = (): CodePipeline.StageProps[] => {
    const lambdaBuild = this.renderLambdaBuild();

    const sourceOutput = new CodePipeline.Artifact();
    const lambdaBuildOutput = new CodePipeline.Artifact('LambdaBuildOutput');
    const reactBuildOutput = new CodePipeline.Artifact('ReactBuildOutput');

    const sourceAuth = SecretsManager.Secret.fromSecretAttributes(this, 'GithubSecret', {
      secretArn: this.props.GithubSecretArn,
    }).secretValueFromJson('OAuth');

    return [
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
        stageName: 'SelfMutate',
        actions: [
          new CodePipelineActions.CodeBuildAction({
            actionName: 'SelfMutate',
            project: this.renderStackDeploy('DeployStack'),
            input: sourceOutput,
            outputs: [],
          }),
        ],
      },
      {
        stageName: 'CompileBackend',
        actions: [
          new CodePipelineActions.CodeBuildAction({
            actionName: 'LambdaBuild',
            project: lambdaBuild,
            input: sourceOutput,
            outputs: [lambdaBuildOutput],
          }),
        ],
      },
      {
        stageName: 'DeployPersonalStack',
        actions: [
          new CodePipelineActions.CodeBuildAction({
            actionName: 'StackDeploy',
            project: this.renderStackDeploy('PersonalStack'),
            input: sourceOutput,
            outputs: [],
          }),
        ],
      },
      {
        stageName: 'CompileReactApp',
        actions: [
          new CodePipelineActions.CodeBuildAction({
            actionName: 'CompileReactApp',
            project: this.renderReactApp(),
            input: sourceOutput,
            outputs: [reactBuildOutput],
          }),
        ],
      },
      {
        stageName: 'UploadStaticAssets',
        actions: [
          new CodePipelineActions.S3DeployAction({
            actionName: 'UploadStaticAssets',
            bucket: S3.Bucket.fromBucketName(this, 'StaticAssetsBucket', this.props.StaticAssetsBucket),
            input: reactBuildOutput,
          }),
        ],
      },
    ];
  };
}
