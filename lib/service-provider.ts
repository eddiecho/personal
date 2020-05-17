import * as SecretsManager from 'aws-sdk/clients/secretsmanager';

export class ServiceProvider {
  private static secretsManager: SecretsManager;

  public static getSecretsManager() {
    if (ServiceProvider.secretsManager == undefined) {
      ServiceProvider.secretsManager = new SecretsManager();
    }

    return ServiceProvider.secretsManager;
  }
}
