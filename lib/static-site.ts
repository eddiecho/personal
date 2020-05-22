import * as Acm from '@aws-cdk/aws-certificatemanager';
import * as Cloudfront from '@aws-cdk/aws-cloudfront';
import * as Route53 from '@aws-cdk/aws-route53';
import * as Route53Targets from '@aws-cdk/aws-route53-targets';
import * as S3 from '@aws-cdk/aws-s3';
import { Construct } from '@aws-cdk/core';

export interface StaticSiteProps {
  // something like www
  siteSubDomain: string;
  // the actual name, ie eddiecho.io
  domainName: string;
}

export class StaticSite extends Construct {
  constructor(parent: Construct, name: string, props: StaticSiteProps) {
    super(parent, name);

    const domain = `${props.siteSubDomain}.${props.domainName}`;
    const wildcardDomain = `*.${props.domainName}`;
    const hostedZone = Route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: props.domainName });

    const siteBucket = new S3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      blockPublicAccess: S3.BlockPublicAccess.BLOCK_ALL,
    });

    const certificateArn = new Acm.DnsValidatedCertificate(this, 'SiteCertificate', {
      hostedZone,
      domainName: wildcardDomain,
    }).certificateArn;

    const siteOriginAccessIdentity = new Cloudfront.OriginAccessIdentity(this, 'SiteAccessIdentity', {
      comment: 'Site OAI',
    });

    const distribution = new Cloudfront.CloudFrontWebDistribution(this, 'SiteDistribution', {
      aliasConfiguration: {
        acmCertRef: certificateArn,
        names: [domain],
        sslMethod: Cloudfront.SSLMethod.SNI,
        securityPolicy: Cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
      },
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: siteBucket,
            originAccessIdentity: siteOriginAccessIdentity,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    });

    new Route53.ARecord(this, 'SiteAliasRecord', {
      recordName: domain,
      target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(distribution)),
      zone: hostedZone,
    });
  }
}
