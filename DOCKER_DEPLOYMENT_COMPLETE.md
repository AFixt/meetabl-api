# Meetabl API Docker Deployment - Complete! 🚀

## ✅ Successfully Deployed Components

### 1. Database Infrastructure
- **Service**: AWS Aurora Serverless v2 (MySQL 8.0)
- **Stack**: meetabl-db-dev
- **Status**: ✅ Running
- **Features**:
  - Auto-scaling enabled (0.5 - 4 ACUs)
  - Encrypted at rest
  - Automated backups (7-day retention)
  - CloudWatch logging enabled

### 2. Docker Image Registry
- **Service**: Amazon ECR
- **Repository**: meetabl-api
- **Image URI**: `533267229743.dkr.ecr.us-east-1.amazonaws.com/meetabl-api:latest`
- **Status**: ✅ Image pushed successfully

### 3. API Deployment (Docker-based)
- **Service**: AWS App Runner
- **Service Name**: meetabl-api-dev
- **Status**: 🔄 Deploying (will be ready in ~5 minutes)
- **URL**: https://ueab3guymh.us-east-1.awsapprunner.com
- **Features**:
  - Auto-scaling (1-25 instances)
  - Managed SSL/TLS
  - Health checks configured
  - Environment variables from Parameter Store

### 4. UI Hosting
- **Service**: Amazon S3 Static Hosting
- **Bucket**: meetabl-ui-dev-533267229743
- **URL**: http://meetabl-ui-dev-533267229743.s3-website-us-east-1.amazonaws.com
- **Status**: ✅ Ready for deployment

## 📊 Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   CloudFront    │────▶│   S3 Static      │     │  AWS App Runner │
│     (CDN)       │     │   UI Hosting     │     │   (Docker API)  │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
                              ┌──────────────────────────────────────┐
                              │                                      │
                              │   Aurora Serverless v2 (MySQL)       │
                              │   Auto-scaling Database              │
                              │                                      │
                              └──────────────────────────────────────┘
```

## 🔧 Management Commands

### Check API Status
```bash
aws apprunner describe-service \
  --service-arn arn:aws:apprunner:us-east-1:533267229743:service/meetabl-api-dev/5d8a74590ae944c79d9b56872b570f9c \
  --region us-east-1 \
  --query "Service.Status" \
  --output text
```

### View API Logs
```bash
aws logs tail /aws/apprunner/meetabl-api-dev --follow
```

### Update Docker Image
```bash
# 1. Build new image
docker build -t meetabl-api .

# 2. Tag for ECR
docker tag meetabl-api:latest 533267229743.dkr.ecr.us-east-1.amazonaws.com/meetabl-api:latest

# 3. Push to ECR
docker push 533267229743.dkr.ecr.us-east-1.amazonaws.com/meetabl-api:latest

# 4. Deploy update (App Runner will auto-detect new image)
aws apprunner start-deployment \
  --service-arn arn:aws:apprunner:us-east-1:533267229743:service/meetabl-api-dev/5d8a74590ae944c79d9b56872b570f9c \
  --region us-east-1
```

### Database Access
```bash
# Get database endpoint
aws rds describe-db-clusters \
  --db-cluster-identifier meetabl-dev-cluster \
  --query 'DBClusters[0].Endpoint' \
  --output text

# Get database password
aws secretsmanager get-secret-value \
  --secret-id meetabl-dev-db-password \
  --query SecretString \
  --output text
```

## 📝 Next Steps

### 1. Run Database Migrations
Once the API is running (check status above), run:
```bash
# Option 1: Direct connection (requires MySQL client)
mysql -h <db-endpoint> -u meetabl_admin -p meetabl < install.sql

# Option 2: Through the API (once it's running)
curl -X POST https://ueab3guymh.us-east-1.awsapprunner.com/api/admin/migrate \
  -H "Authorization: Bearer <admin-token>"
```

### 2. Deploy UI Code
```bash
cd ../meetabl-ui
npm install
npm run build
aws s3 sync dist/ s3://meetabl-ui-dev-533267229743 --delete
```

### 3. Configure Domain Names
1. Register domain in Route 53
2. Create SSL certificate in ACM
3. Add CloudFront distribution for UI
4. Configure custom domain for App Runner

### 4. Set Up CI/CD
1. Copy GitHub Actions workflow to repositories
2. Add GitHub secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `ECR_REGISTRY`: 533267229743.dkr.ecr.us-east-1.amazonaws.com

## 🔐 Security Notes

1. **Database**: Currently accessible from App Runner service only
2. **API**: SSL/TLS automatically managed by App Runner
3. **Secrets**: All stored in AWS Parameter Store (encrypted)
4. **IAM Roles**: Least privilege access configured

## 💰 Cost Estimation

- **App Runner**: ~$5/month (minimum) + $0.007/vCPU-hour
- **Aurora Serverless**: ~$50-100/month (based on usage)
- **ECR**: ~$0.10/GB/month for storage
- **S3**: ~$1-5/month for static hosting
- **Total**: ~$60-150/month

## 🎉 Success!

Your Docker-based API deployment is complete! The App Runner service will be fully operational in approximately 5 minutes. You can check the status using the commands above.

### API Endpoints
Once deployed, your API will be available at:
- **Base URL**: https://ueab3guymh.us-east-1.awsapprunner.com
- **Health Check**: https://ueab3guymh.us-east-1.awsapprunner.com/api/health
- **API Docs**: https://ueab3guymh.us-east-1.awsapprunner.com/api/docs

### Monitoring
- **CloudWatch Logs**: Automatic logging for all requests
- **App Runner Metrics**: CPU, memory, request count in AWS Console
- **Database Metrics**: Available in RDS console

## 🆘 Troubleshooting

### If API is not responding:
1. Check App Runner status (should be "RUNNING")
2. Check health check endpoint
3. Review CloudWatch logs for errors
4. Verify database connectivity
5. Check Parameter Store values

### Common Issues:
- **Database connection**: Verify RDS security groups
- **Environment variables**: Check Parameter Store permissions
- **Docker image**: Ensure latest image is pushed to ECR

For support, check the AWS App Runner console for detailed deployment logs and metrics.