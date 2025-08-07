#!/bin/bash

# Deploy meetabl API using AWS App Runner
# This is a simpler alternative to ECS for containerized applications

ENVIRONMENT="dev"
REGION="us-east-1"
SERVICE_NAME="meetabl-api-${ENVIRONMENT}"
ECR_URI="533267229743.dkr.ecr.us-east-1.amazonaws.com/meetabl-api:latest"

echo "Creating App Runner service..."

# Create the App Runner configuration
cat > /tmp/apprunner-config.json <<EOF
{
  "ServiceName": "${SERVICE_NAME}",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "${ECR_URI}",
      "ImageConfiguration": {
        "Port": "3001",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3001",
          "DB_DIALECT": "mysql"
        },
        "RuntimeEnvironmentSecrets": {
          "DB_HOST": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/db-host",
          "DB_NAME": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/db-name",
          "DB_USERNAME": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/db-username",
          "DB_PASSWORD": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/db-password",
          "JWT_SECRET": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/jwt-secret",
          "JWT_REFRESH_SECRET": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/jwt-refresh-secret",
          "FRONTEND_URL": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/frontend-url",
          "STRIPE_SECRET_KEY": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/stripe-secret-key",
          "STRIPE_PUBLISHABLE_KEY": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/stripe-publishable-key",
          "STRIPE_WEBHOOK_SECRET": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/stripe-webhook-secret"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::533267229743:role/service-role/AppRunnerECRAccessRole"
    }
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB",
    "InstanceRoleArn": "arn:aws:iam::533267229743:role/AppRunnerInstanceRole"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 2,
    "UnhealthyThreshold": 3
  }
}
EOF

# First, create the necessary IAM roles
echo "Creating IAM roles for App Runner..."

# Create ECR Access Role
aws iam create-role --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "build.apprunner.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' 2>/dev/null || echo "ECR Access Role already exists"

# Attach ECR access policy
aws iam attach-role-policy --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess 2>/dev/null

# Create Instance Role
aws iam create-role --role-name AppRunnerInstanceRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "tasks.apprunner.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' 2>/dev/null || echo "Instance Role already exists"

# Create and attach SSM parameter access policy
cat > /tmp/ssm-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:${REGION}:533267229743:parameter/meetabl/${ENVIRONMENT}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy --role-name AppRunnerInstanceRole \
  --policy-name SSMParameterAccess \
  --policy-document file:///tmp/ssm-policy.json

echo "Creating App Runner service..."
aws apprunner create-service --cli-input-json file:///tmp/apprunner-config.json --region ${REGION}

echo "✅ App Runner deployment initiated!"
echo "Check the AWS Console for the service URL once deployment is complete."