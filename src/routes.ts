import dayjs from "dayjs";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "./lib/prisma";

export async function appRoutes(app: FastifyInstance) {
  app.post("/habits", async (request) => {
    // We are using the z library to create a body parser/validator here
    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(z.number().min(0).max(6)),
    });

    const { title, weekDays } = createHabitBody.parse(request.body);

    // This will make the date from the 00:00:00 hour
    const today = dayjs().startOf("day").toDate();

    await prisma.habit.create({
      data: {
        title,
        created_at: today,
        weekDays: {
          create: weekDays.map((weekDay) => {
            return { week_day: weekDay };
          }),
        },
      },
    });
  });

  app.get("/day", async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date(), // This will convert what we receive here to a Date type (string->Date)
    });

    // Ex: localhost:3333/day?date=2022-01-13T00...
    const { date } = getDayParams.parse(request.query);

    const parsedDate = dayjs(date).startOf("day");
    const weekDay = parsedDate.get("day");

    // Here we need all possible habits
    // All habits that have been completed
    const possibleHabits = await prisma.habit.findMany({
      where: {
        // Searching for less than or equal (lte) the current date
        created_at: {
          lte: date,
        },
        // Here we are trying to find in the weekDays if at least
        // one of them is the current day of the week
        weekDays: {
          some: {
            week_day: weekDay,
          },
        },
      },
    });

    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate(), // we need to convert do JS Date when working with prisma
      },
      // This will bring all dayHabits that are related to this day
      // By default this information won't be returned
      include: {
        dayHabits: true,
      },
    });

    // ? will verify if day is null (it can be)
    // This is called "Optional chaining (?.)"
    const completedHabits = day?.dayHabits.map((dayHabit) => {
      return dayHabit.habit_id;
    });

    //If completedHabits is undefined it wont be included in the return
    return {
      possibleHabits,
      completedHabits,
    };
  });
}
