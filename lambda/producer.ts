import { ScheduledHandler } from "aws-lambda";
import { SQS } from "aws-sdk";

const sqs = new SQS();

export const handler: ScheduledHandler = async (
  event,
  context
): Promise<any> => {
  console.log("Event: ", JSON.stringify(event, null, 2));
  console.log("Context: ", JSON.stringify(context, null, 2));

  try {
    for (let i = 0; i < 50; i++) {
      await sqs
        .sendMessage({
          QueueUrl: process.env.SQS_QUEUE_URL!,
          MessageBody: JSON.stringify({
            message: `Message ${i}`,
            date: new Date().toISOString(),
            data: ["AAPL", "GOOGL", "AMZN", "MSFT", "TSLA"],
          }),
          // FIFO queue requires these
          // MessageGroupId: "group1",
          // MessageDeduplicationId: `message${i}`,
        })
        .promise();
    }
  } catch (error) {
    console.error("Failed to send message to SQS", error);
    return "Failed to send message to SQS";
  }

  console.info("Messages sent to SQS");
  return "OK";
};
