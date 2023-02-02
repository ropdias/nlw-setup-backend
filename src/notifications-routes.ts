import WebPush from "web-push";
require("dotenv").config();
import { FastifyInstance } from "fastify";
import { z } from "zod";

// Use first the comand console.log(WebPush.generateVAPIDKeys()); to generate public and private keys:
const publicKey = process.env.VAPID_PUBLIC_KEY!;
const privateKey = process.env.VAPID_PRIVATE_KEY!;

// If publicKey and privateKey is null this will fail and server wont start.
WebPush.setVapidDetails("http://localhost:3333", publicKey, privateKey);

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/push/public_key", () => {
    return {
      publicKey,
    };
  });

  app.post("/push/register", (request, reply) => {
    // Here we should add the subscription to a prisma database UserNotificationSubscriptions
    // console.log(request.body);

    return reply.status(201).send();
  });

  app.post("/push/send", async (request, reply) => {
    const sendPushBody = z.object({
      subscription: z.object({
        endpoint: z.string(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
    });

    const { subscription } = sendPushBody.parse(request.body);

    // We can send delayed messages to the user, and they will receive even if the tab was closed
    // setTimeout(() => {
    //   WebPush.sendNotification(subscription, "HELLO DO BACKEND");
    // }, 5000);

    WebPush.sendNotification(
      subscription,
      "Olá, Rodrigo! 🤩 Você praticou os seus hábitos hoje?"
    );

    return reply.status(201).send();
  });
}
