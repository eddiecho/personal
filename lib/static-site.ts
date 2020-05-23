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
  public bucket: string;

  private props: StaticSiteProps;
  private hostedZone: Route53.IHostedZone;

  constructor(parent: Construct, name: string, props: StaticSiteProps) {
    super(parent, name);

    this.props = props;

    const domain = `${props.siteSubDomain}.${props.domainName}`;
    const wildcardDomain = `*.${props.domainName}`;
    this.hostedZone = Route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: props.domainName });

    const bucket = new S3.Bucket(this, 'SiteBucket', {
      bucketName: 'personal-stack-site-bucket-609842208353',
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      blockPublicAccess: S3.BlockPublicAccess.BLOCK_ALL,
    });
    this.bucket = bucket.bucketName;

    const certificateArn = new Acm.DnsValidatedCertificate(this, 'SiteCertificate', {
      hostedZone: this.hostedZone,
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
            s3BucketSource: bucket,
            originAccessIdentity: siteOriginAccessIdentity,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    });

    new Route53.ARecord(this, 'SiteAliasRecord', {
      recordName: domain,
      target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(distribution)),
      zone: this.hostedZone,
    });

    this.renderNakedDomainRedirect();
  }

  private renderNakedDomainRedirect = () => {
    const redirectBucket: S3.Bucket = new S3.Bucket(this, 'NakedRedirectBucket', {
      websiteRedirect: {
        protocol: S3.RedirectProtocol.HTTPS,
        hostName: `www.${this.props.domainName}`,
      },
    });

    const redirectCert = new Acm.DnsValidatedCertificate(this, 'NakedRedirectCertificate', {
      hostedZone: this.hostedZone,
      domainName: this.props.domainName,
    });

    const redirectDistribution = new Cloudfront.CloudFrontWebDistribution(this, 'RedirectDistribution', {
      aliasConfiguration: {
        acmCertRef: redirectCert.certificateArn,
        names: [this.props.domainName],
        sslMethod: Cloudfront.SSLMethod.SNI,
        securityPolicy: Cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
      },
      originConfigs: [
        {
          customOriginSource: {
            domainName: redirectBucket.bucketWebsiteDomainName,
          },
          behaviors: [{isDefaultBehavior: true}],
        },
      ],
    });

    new Route53.ARecord(this, 'RedirectAliasRecord', {
      recordName: this.props.domainName,
      target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(redirectDistribution)),
      zone: this.hostedZone,
    });
  };
}
