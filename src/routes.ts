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
    const completedHabits =
      day?.dayHabits.map((dayHabit) => {
        return dayHabit.habit_id;
      }) ?? []; // If completedHabits is undefined or null it will be []

    return {
      possibleHabits,
      completedHabits,
    };
  });

  app.patch("/habits/:id/toggle", async (request) => {
    const toggleHabitParams = z.object({
      id: z.string().uuid(), // This will validate if this is an uuid
    });

    const { id } = toggleHabitParams.parse(request.params);

    const today = dayjs().startOf("day").toDate();

    // We will check if we have the day in the database already
    let day = await prisma.day.findUnique({
      where: {
        date: today,
      },
    });

    if (!day) {
      // If we don't find in the database we will create one register
      day = await prisma.day.create({
        data: {
          date: today,
        },
      });
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id,
        },
      },
    });

    if (dayHabit) {
      // then we will delete that habit associated with that day (untoggle)
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id,
        },
      });
    } else {
      // then we will create that habit associated with that day (toggle)
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id,
        },
      });
    }
  });

  app.get("/summary", async () => {
    // [ {date: 17/01, amount: 5, completed: 1},
    //   {date: 18/01, amount: 2, completed: 2},
    //   {date: 17/01, amount: 5, completed: 1}]

    const summary = await prisma.$queryRaw`
      SELECT 
        D.id, 
        D.date,
        (
          SELECT
            cast(count(*) as float)
          FROM day_habits DH
          WHERE DH.day_id = D.id
        ) as completed,
        (
          SELECT
            cast(count(*) as float)
          FROM habit_week_days HWD
          JOIN habits H
            ON H.id = HWD.habit_id
          WHERE
            HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
            AND
            H.created_at <= D.date
        ) as amount
      FROM days D
    `;

    return summary;
  });
}
