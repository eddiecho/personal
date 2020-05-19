import { Construct, Stack, StackProps } from '@aws-cdk/core';

import { StaticSite } from './static-site';

export class PersonalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new StaticSite(this, 'StaticSite', {
      domainName: 'eddiecho.io',
      siteSubDomain: 'www',
    });
  }
}
