import { SQSHandler } from "aws-lambda";
import { SQS } from "aws-sdk";

const sqs = new SQS();

export const handler: SQSHandler = async (event, context): Promise<any> => {
  console.log("Event: ", JSON.stringify(event, null, 2));
  console.log("Context: ", JSON.stringify(context, null, 2));

  // simulate some work with random time from
  const time = 3 * 1000;
  console.info(`Processing message for ${time} ms`);
  await sleep(time);

  // remove message from queue in 60% of cases
  if (Math.random() > 0.4) {
    console.info("Message processed");

    try {
      // delete messages from queue
      const queueUrl = process.env.SQS_QUEUE_URL!;
      const messages = event.Records;
      await sqs
        .deleteMessageBatch({
          QueueUrl: queueUrl,
          Entries: messages.map((message) => ({
            Id: message.messageId,
            ReceiptHandle: message.receiptHandle,
          })),
        })
        .promise();

      return "OK";
    } catch (error) {
      console.error("Failed to delete message from SQS", error);
      return "Failed to delete message from SQS";
    }
  }

  console.error("Message processing failed");
  return "FAILED";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
