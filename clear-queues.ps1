# Set your AWS region
$region = "us-west-2"  # Replace with your region if different
$account = (aws sts get-caller-identity --query "Account" --output text)

# Queue URLs
$smsQueueUrl = "https://sqs.${region}.amazonaws.com/${account}/sms-otp-sms-delivery"
$eventsQueueUrl = "https://sqs.${region}.amazonaws.com/${account}/sms-otp-events"
$dlqQueueUrl = "https://sqs.us-west-2.amazonaws.com/082800993317/sms-otp-dlq"
# Function to purge a queue
function Purge-Queue {
    param($queueUrl, $queueName)
    Write-Host "Purging queue: $queueName"
    try {
        aws sqs purge-queue --queue-url $queueUrl
        Write-Host "Successfully purged $queueName queue" -ForegroundColor Green
    } catch {
        Write-Host "Error purging $queueName queue: $_" -ForegroundColor Red
    }
}

# Purge both queues
Purge-Queue -queueUrl $smsQueueUrl -queueName "SMS Delivery"
Purge-Queue -queueUrl $eventsQueueUrl -queueName "Events"
Purge-Queue -queueUrl $dlqQueueUrl -queueName "dlq"


# Optional: Verify queues are empty
function Get-QueueAttributes {
    param($queueUrl, $queueName)
    $attrs = aws sqs get-queue-attributes --queue-url $queueUrl --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible --output json | ConvertFrom-Json
    Write-Host "`nQueue: $queueName"
    Write-Host "Messages available: $($attrs.Attributes.ApproximateNumberOfMessages)"
    Write-Host "Messages in flight: $($attrs.Attributes.ApproximateNumberOfMessagesNotVisible)"
}

Write-Host "`nVerifying queue status:"
Get-QueueAttributes -queueUrl $smsQueueUrl -queueName "SMS Delivery"
Get-QueueAttributes -queueUrl $eventsQueueUrl -queueName "Events"
Get-QueueAttributes -queueUrl $dlqQueueUrl -queueName "dlq"