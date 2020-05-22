import { Construct, Stack, StackProps } from '@aws-cdk/core';
import * as S3 from '@aws-cdk/aws-s3';

import { StaticSite } from './static-site';

export class PersonalStack extends Stack {
  public staticAssetsBucket: S3.IBucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const staticSite = new StaticSite(this, 'StaticSite', {
      domainName: 'eddiecho.io',
      siteSubDomain: 'www',
    });

    this.staticAssetsBucket = staticSite.bucket;
  }
}
