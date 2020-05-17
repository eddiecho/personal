import { expect, haveResource, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as Personal from '../lib/personal-stack';

describe('Personal Stack', () => {
  test('Empty Stack', () => {
    const app = new cdk.App();

    const stack = new Personal.PersonalStack(app, 'MyTestStack');
    expect(stack).to(haveResource('AWS::Lambda::Function'));
  });
});
