import { expect, countResources } from '@aws-cdk/assert';
import * as Cdk from '@aws-cdk/core';

import * as Personal from '../lib/personal-stack';

describe('Personal Stack', () => {
  const app = new Cdk.App();

  const stack = new Personal.PersonalStack(app, 'MyTestStack');
  test('Empty Stack', () => {
    expect(stack).to(countResources('AWS::Lambda::Function', 1));
  });
});
