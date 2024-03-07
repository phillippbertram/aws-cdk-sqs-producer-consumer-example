import { SQSHandler } from "aws-lambda";
import { SQS } from "aws-sdk";

const sqs = new SQS();

// moves messages from DLQ to the main queue
export const handler: SQSHandler = async (event, context): Promise<any> => {
  console.log("Event: ", JSON.stringify(event, null, 2));
  console.log("Context: ", JSON.stringify(context, null, 2));

  try {
    // get messages from DLQ and send them to the main queue
    const dlqUrl = process.env.DLQ_URL!;
    const queueUrl = process.env.SQS_QUEUE_URL!;
    const messages = await sqs
      .receiveMessage({
        QueueUrl: dlqUrl,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 10,
      })
      .promise();

    if (messages.Messages) {
      console.info(`Received ${messages.Messages.length} messages from DLQ`);
      for (const message of messages.Messages) {
        await sqs
          .sendMessage({
            QueueUrl: queueUrl,
            MessageBody: message.Body!,
            // FIFO queue requires these
            // MessageGroupId: "group1",
            // MessageDeduplicationId: message.MessageId!,
          })
          .promise();

        await sqs
          .deleteMessage({
            QueueUrl: dlqUrl,
            ReceiptHandle: message.ReceiptHandle!,
          })
          .promise();

        console.info(
          `Sent ${messages.Messages.length} to the main queue and deleted from DLQ`
        );
      }
    }

    return "OK";
  } catch (error) {
    console.error("Failed to delete message from SQS", error);
    return "Failed to delete message from SQS";
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
