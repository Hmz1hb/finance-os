# S3 Receipt Bucket Lifecycle

The application writes receipt/document objects to a private S3 bucket using the container/task/instance IAM role. Configure the bucket outside the app with:

- Block all public access enabled.
- Default encryption enabled.
- Lifecycle rule for prefix `receipts/`:
  - Transition current objects to Glacier Flexible Retrieval after 730 days.
  - Keep thumbnails with the same lifecycle unless you want fast previews forever.
- IAM role permissions:
  - `s3:PutObject`
  - `s3:GetObject`
  - `s3:DeleteObject` if you later add hard-delete cleanup
  - Resource scope: `arn:aws:s3:::YOUR_BUCKET_NAME/receipts/*`
