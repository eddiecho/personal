import * as SecretsManager from 'aws-sdk/clients/secretsmanager';

import { ServiceProvider } from './service-provider';

export const getSecret = async (secretId: string): Promise<SecretsManager.DescribeSecretResponse> => {
  const secrets = ServiceProvider.getSecretsManager();
  const describeSecretRequest: SecretsManager.DescribeSecretRequest = {
    SecretId: secretId,
  };
  return secrets.describeSecret(describeSecretRequest).promise();
};
