// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Catalog fixture with the services used by content/scenarios/serverless-pdf-processing.
// leakPatterns follow docs/03 §4; they are test data, not the curated catalog.
import type { ConfusionGroup, Service } from "@blueprint/scenario-schema";
import { service } from "./fixtures.js";

export const pdfCatalog: Service[] = [
  service("apigateway", "Amazon API Gateway", ["API Gateway"]),
  service("alb", "Application Load Balancer", ["ALB", "Application Load Balancer"]),
  service("route53", "Amazon Route 53", ["Route 53", "Route53"]),
  service("ec2", "Amazon EC2", ["EC2", "Elastic Compute Cloud"]),
  service("lambda", "AWS Lambda", ["Lambda"]),
  service("fargate", "AWS Fargate", ["Fargate"]),
  service("s3", "Amazon S3", ["S3", "Simple Storage Service"]),
  service("efs", "Amazon EFS", ["EFS", "Elastic File System"]),
  service("ebs", "Amazon EBS", ["EBS", "Elastic Block Store"]),
  service("dynamodb", "Amazon DynamoDB", ["DynamoDB"]),
  service("sqs", "Amazon SQS", ["SQS", "Simple Queue Service"]),
  service("eventbridge", "Amazon EventBridge", ["EventBridge"]),
  service("kinesis-data-streams", "Amazon Kinesis Data Streams", ["Kinesis"]),
  service("sns", "Amazon SNS", ["SNS", "Simple Notification Service"]),
  service("textract", "Amazon Textract", ["Textract"]),
  service("bedrock", "Amazon Bedrock", ["Bedrock"]),
  service("rekognition", "Amazon Rekognition", ["Rekognition"]),
  service("sagemaker-ai", "Amazon SageMaker AI", ["SageMaker"]),
  service("aurora", "Amazon Aurora", ["Aurora"]),
  service("redshift", "Amazon Redshift", ["Redshift"]),
  service("elasticache", "Amazon ElastiCache", ["ElastiCache"]),
  service("cloudwatch", "Amazon CloudWatch", ["CloudWatch"]),
];

export const pdfConfusionGroups: ConfusionGroup[] = [
  { id: "messaging", services: ["sqs", "sns", "eventbridge", "kinesis-data-streams"] },
  { id: "compute", services: ["lambda", "fargate", "ec2"] },
];
