import * as cdk from "aws-cdk-lib";
import {
  aws_events,
  aws_events_targets,
  aws_lambda,
  aws_lambda_nodejs,
  aws_lambda_event_sources,
  aws_logs,
  aws_sqs,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import path = require("path");

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const deadLetterQueue = new aws_sqs.Queue(this, "DeadLetterQueue", {});

    const queue = new aws_sqs.Queue(this, "MessageQueue", {
      // the time that the message is invisible in the queue after a reader picks it up
      // if the reader fails to process the message within this time, the message will become visible again
      visibilityTimeout: Duration.minutes(5),

      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue,
      },
    });

    // PRODUCER
    const producer = new aws_lambda_nodejs.NodejsFunction(
      this,
      "ProducerLambda",
      {
        runtime: aws_lambda.Runtime.NODEJS_16_X,
        handler: "handler",
        entry: path.join(__dirname, "..", "lambda", "producer.ts"),
        timeout: Duration.minutes(1),
        logRetention: aws_logs.RetentionDays.ONE_DAY,
        environment: {
          SQS_QUEUE_URL: queue.queueUrl,
        },
      }
    );
    queue.grantSendMessages(producer);
    new aws_events.Rule(this, "my-lambda-rule", {
      description: "Triggers the producer lambda every minute",
      targets: [new aws_events_targets.LambdaFunction(producer)],
      schedule: aws_events.Schedule.rate(Duration.minutes(1)), // smallest unit is minutes
      // ALTERNATIVE: schedule: aws_events.Schedule.cron({ minute: "10"})
    });

    // CONSUMER
    const consumer = new aws_lambda_nodejs.NodejsFunction(
      this,
      "ConsumerLambda",
      {
        runtime: aws_lambda.Runtime.NODEJS_16_X,
        handler: "handler",
        entry: path.join(__dirname, "..", "lambda", "consumer.ts"),
        timeout: Duration.minutes(1),
        reservedConcurrentExecutions: 100, // limit the number of concurrent executions
        logRetention: aws_logs.RetentionDays.ONE_DAY,
        environment: {
          SQS_QUEUE_URL: queue.queueUrl,
        },
      }
    );
    queue.grantConsumeMessages(consumer);
    const eventSource = new aws_lambda_event_sources.SqsEventSource(queue, {
      batchSize: 1, // we want to process one message at a time
    });
    consumer.addEventSource(eventSource);

    // dlqLambda (MUST) be manually triggered to move messages from DLQ to the main queue
    const dlqLambda = new aws_lambda_nodejs.NodejsFunction(this, "DLQLambda", {
      runtime: aws_lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, "..", "lambda", "dlq.ts"),
      timeout: Duration.minutes(1),
      logRetention: aws_logs.RetentionDays.ONE_DAY,
      environment: {
        DLQ_URL: deadLetterQueue.queueUrl,
        SQS_QUEUE_URL: queue.queueUrl,
      },
    });
    queue.grantSendMessages(dlqLambda);
    deadLetterQueue.grantConsumeMessages(dlqLambda);
  }
}
