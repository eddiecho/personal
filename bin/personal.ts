#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PersonalStack } from '../lib/personal-stack';

const app = new cdk.App();
new PersonalStack(app, 'PersonalStack');
