import * as CodeBuild from "@aws-cdk/aws-codebuild";
import * as CodePipeline from "@aws-cdk/aws-codepipeline";
import * as CodePipelineActions from "@aws-cdk/aws-codepipeline-actions";
import { App, Stack, StackProps } from "@aws-cdk/core";

export interface DeployStackProps extends StackProps {}

export class DeployStack extends Stack {
  constructor(app: App, id: string, props: DeployStackProps) {
    super(app, id, props);

    const cdkBuild = new CodeBuild.PipelineProject(this, "CdkBuild", {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: "1.0",
        phases: {
          install: {
            commands: "npm install",
          },
          build: {
            commands: ["npm run build", "npm run cdk synth -- -o dist"],
          },
        },
        artifacts: {
          "base-directory": "dist",
          files: ["PersonalStack.template.json"],
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_2_0,
      },
    });
    const lambdaBuild = new CodeBuild.PipelineProject(this, "LambdaBuild", {
      buildSpec: CodeBuild.BuildSpec.fromObject({
        version: "1.0",
        phases: {
          install: {
            commands: ["cd lambda", "npm install"],
          },
          build: {
            commands: "npm run build",
          },
        },
        artifacts: {
          "base-directory": "lambda",
          files: ["index.js", "node_modules/**/*"],
        },
      }),
      environment: {
        buildImage: CodeBuild.LinuxBuildImage.STANDARD_2_0,
      },
    });

    const sourceOutput = new CodePipeline.Artifact();
    const cdkBuildOutput = new CodePipeline.Artifact('CdkBuildOutput');
    const lambdaBuildOutput = new CodePipeline.Artifact('LambdaBuildOutput');
    new CodePipeline.Pipeline(this, 'Pipeline', {
        stages: [
            {
                stageName: 'Source',
                actions: [
                    new CodePipelineActions.GitHubSourceAction({
                        actionName: "GithubSource",
                        output: sourceOutput,
                        repo: 'personal',
                        branch: 'master',
                        owner: 'eddiecho',
                        oauthToken: 'this will fail'
                    })
                ]
            }
        ]
    })
  }
}
