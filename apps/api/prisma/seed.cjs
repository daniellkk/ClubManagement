/* Development seed — Hapoel Be'er Sheva demo club with realistic Hebrew data.
   Idempotent: wipes and recreates all data. NEVER run against production. */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Dev-only login for the seeded admin (change before any real deployment)
const DEV_ADMIN_EMAIL = "admin@hapoel-bs.demo";
const DEV_ADMIN_PASSWORD = "Hapoel2026!";

function monthsAgo(n, day = 15) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  d.setHours(12, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  // Wipe in FK-safe order
  await prisma.auditLog.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.consentLog.deleteMany();
  await prisma.messageLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.shuttleRegistration.deleteMany();
  await prisma.shuttle.deleteMany();
  await prisma.ticketPurchase.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.game.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.fanTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.fan.deleteMany();
  await prisma.season.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.club.deleteMany();

  const club = await prisma.club.create({
    data: {
      slug: "hapoel-beer-sheva",
      name: "הפועל באר שבע",
      primaryColor: "#dc2626",
      sidebarColor: "#1a1a1a",
    },
  });

  await prisma.adminUser.create({
    data: {
      clubId: club.id,
      email: DEV_ADMIN_EMAIL,
      passwordHash: bcrypt.hashSync(DEV_ADMIN_PASSWORD, 10),
      name: "מנהל מועדון",
      role: "OWNER",
    },
  });
  console.log(`Admin login → ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);

  const prevSeason = await prisma.season.create({
    data: {
      clubId: club.id,
      name: "2024/25",
      startDate: new Date("2024-08-01"),
      endDate: new Date("2025-05-31"),
      isCurrent: false,
    },
  });

  const season = await prisma.season.create({
    data: {
      clubId: club.id,
      name: "2025/26",
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-05-31"),
      isCurrent: true,
    },
  });

  const tagNames = ["מנוי ותיק", "משפחה", "אוהד שרוף", "סטודנט"];
  const tags = {};
  for (const name of tagNames) {
    tags[name] = await prisma.tag.create({
      data: { clubId: club.id, name },
    });
  }

  // [customerNumber, first, last, age, city, phone, email, subType(current), prevType, score, appDaysAgo, createdMonthsAgo, tags]
  const fanRows = [
    ["10248", "יוסי", "כהן", 34, "באר שבע", "050-1234567", "yossi.c@example.com", "VIP", "VIP", 92, 2, 14, ["אוהד שרוף"]],
    ["10315", "מיכל", "לוי", 28, "באר שבע", "052-2345678", "michal.levi@example.com", "רגיל", "רגיל", 84, 1, 12, []],
    ["10422", "אבי", "פרץ", 45, "אופקים", "054-3456789", "avi.peretz@example.com", null, "זהב", 77, 8, 10, ["מנוי ותיק"]],
    ["10518", "שרה", "ביטון", 31, "דימונה", "053-4567890", "sara.biton@example.com", null, "רגיל", 58, 27, 9, []],
    ["10620", "דוד", "אזולאי", 52, "נתיבות", "050-5678901", "david.az@example.com", "רגיל", "רגיל", 88, 3, 8, ["מנוי ותיק", "משפחה"]],
    ["10711", "רונית", "מלכה", 39, "באר שבע", "052-6789012", "ronit.m@example.com", "רגיל", "רגיל", 65, 14, 6, ["משפחה"]],
    ["10809", "אלי", "דהן", 26, "ירוחם", "054-7890123", "eli.dahan@example.com", null, "סטודנט", 43, 95, 5, ["סטודנט"]],
    ["10933", "נועה", "שטרית", 23, "באר שבע", "053-8901234", "noa.shitrit@example.com", "סטודנט", null, 81, 1, 4, ["סטודנט"]],
    ["11047", "משה", "אוחיון", 61, "שדרות", "050-9012345", "moshe.o@example.com", null, "ותיק", 71, 12, 3, ["מנוי ותיק"]],
    ["11150", "תמר", "עמר", 35, "מיתר", "052-0123456", "tamar.amar@example.com", null, null, 52, 80, 2, []],
    ["11208", "עומר", "חדד", 30, "באר שבע", "054-1112223", "omer.hadad@example.com", "רגיל", "רגיל", 79, 5, 1, []],
    ["11321", "ליאור", "בן שמעון", 41, "רהט", "050-2223334", "lior.bs@example.com", "זהב", null, 86, 4, 0, ["אוהד שרוף"]],
  ];

  const fans = {};
  for (const [customerNumber, firstName, lastName, age, city, phone, email, subType, prevType, score, appDays, createdMonths, fanTagNames] of fanRows) {
    const fan = await prisma.fan.create({
      data: {
        clubId: club.id,
        customerNumber,
        firstName,
        lastName,
        age,
        city,
        phone,
        email,
        status: appDays > 60 ? "INACTIVE" : "ACTIVE",
        memberSince: monthsAgo(createdMonths + 24),
        engagementScore: score,
        appLastLoginAt: daysAgo(appDays),
        appSessionCount: Math.max(1, Math.round(score / 4)),
        emailOptIn: true,
        smsOptIn: score > 60,
        whatsappOptIn: score > 70,
        pushOptIn: score > 75,
        preferredChannel: score > 70 ? "WHATSAPP" : "EMAIL",
        createdAt: monthsAgo(createdMonths),
      },
    });
    fans[customerNumber] = fan;

    for (const tagName of fanTagNames) {
      await prisma.fanTag.create({
        data: { fanId: fan.id, tagId: tags[tagName].id },
      });
    }

    if (prevType) {
      await prisma.subscription.create({
        data: {
          fanId: fan.id,
          seasonId: prevSeason.id,
          type: prevType,
          status: "EXPIRED",
          paymentStatus: "PAID",
          price: prevType === "VIP" ? 2400 : prevType === "זהב" ? 1600 : 950,
        },
      });
    }
    if (subType) {
      await prisma.subscription.create({
        data: {
          fanId: fan.id,
          seasonId: season.id,
          type: subType,
          status: "ACTIVE",
          paymentStatus: "PAID",
          autoRenew: true,
          price: subType === "VIP" ? 2500 : subType === "זהב" ? 1700 : subType === "סטודנט" ? 600 : 990,
        },
      });
    }
  }

  // Games — 2025/26
  const gameRows = [
    // [venue, competition, opponent, stadium, daysAgo(-=future), tickets, subsAtt, total, capacity, revenue, status]
    ["HOME", "LEAGUE", "מכבי תל אביב", "טרנר", 11, 7400, 7900, 15300, 16126, 512000, "PLAYED"],
    ["AWAY", "LEAGUE", "מכבי חיפה", "סמי עופר", 18, 1850, 0, 1710, 2000, 64000, "PLAYED"],
    ["HOME", "LEAGUE", 'בית"ר ירושלים', "טרנר", 25, 6800, 7700, 14500, 16126, 448000, "PLAYED"],
    ["AWAY", "LEAGUE", "הפועל תל אביב", "בלומפילד", 32, 2011, 0, 1930, 2200, 71000, "PLAYED"],
    ["HOME", "LEAGUE", "עירוני קריית שמונה", "טרנר", 39, 3900, 7100, 11000, 16126, 262000, "PLAYED"],
    ["AWAY", "LEAGUE", "בני סכנין", "דוחא", 46, 950, 0, 820, 1500, 29000, "PLAYED"],
    ["HOME", "CUP", "הפועל חיפה", "טרנר", 53, 3200, 6800, 10000, 16126, 231000, "PLAYED"],
    ["HOME", "LEAGUE", "מכבי נתניה", "טרנר", -3, 5200, 0, 0, 16126, 341000, "SCHEDULED"],
    ["AWAY", "CUP", "מכבי פתח תקווה", "המושבה", -17, 620, 0, 0, 1800, 21000, "SCHEDULED"],
  ];

  const games = [];
  for (const [venue, competition, opponent, stadium, dAgo, tickets, subsAtt, total, capacity, revenue, status] of gameRows) {
    const game = await prisma.game.create({
      data: {
        clubId: club.id,
        seasonId: season.id,
        venue,
        competition,
        opponent,
        stadium,
        kickoffAt: daysAgo(dAgo),
        status,
        capacity,
        ticketsSold: tickets,
        subscriberAttendees: subsAtt,
        totalAttendance: total,
        revenue,
      },
    });
    games.push(game);
  }

  // Attendance for engaged fans across played games
  const playedGames = games.filter((g) => g.status === "PLAYED");
  const attendanceMap = {
    "10248": [0, 1, 2, 3, 4, 5, 6],
    "10315": [0, 1, 2, 4, 6],
    "10620": [0, 2, 3, 4, 6],
    "10933": [0, 1, 2, 4],
    "11321": [0, 2, 4, 6],
    "10422": [0, 2, 6],
    "10711": [2, 4],
    "11047": [3],
  };
  for (const [customerNumber, gameIdxs] of Object.entries(attendanceMap)) {
    for (const idx of gameIdxs) {
      const game = playedGames[idx];
      if (!game) continue;
      await prisma.attendance.create({
        data: {
          fanId: fans[customerNumber].id,
          gameId: game.id,
          attended: true,
          source: game.venue === "AWAY" ? "TICKET" : "SUBSCRIPTION",
        },
      });
    }
  }

  // Shuttles for away games
  for (const game of games.filter((g) => g.venue === "AWAY" && g.status === "PLAYED")) {
    const shuttle = await prisma.shuttle.create({
      data: {
        gameId: game.id,
        departureLocation: "אצטדיון טרנר, באר שבע",
        departureAt: new Date(game.kickoffAt.getTime() - 3 * 60 * 60 * 1000),
        capacity: 350,
        price: 40,
      },
    });
    for (const cn of ["10248", "10620", "10933"]) {
      await prisma.shuttleRegistration.create({
        data: {
          shuttleId: shuttle.id,
          fanId: fans[cn].id,
          status: "ATTENDED",
        },
      });
    }
  }

  // Campaigns
  await prisma.campaign.create({
    data: {
      clubId: club.id, name: "קמפיין חידוש מנויים 2026/27", channel: "EMAIL",
      category: "MARKETING", status: "SENDING", reach: 3420,
      body: "חדשו את המנוי לעונת 2026/27 ותיהנו ממחיר מוקדם!",
      createdAt: daysAgo(9),
    },
  });
  await prisma.campaign.create({
    data: {
      clubId: club.id, name: "יום הולדת — אוגוסט", channel: "WHATSAPP",
      category: "GOODWILL", status: "SCHEDULED", reach: 512,
      body: "מזל טוב! כל הקבוצה מאחלת לך יום הולדת שמח 🎉",
      createdAt: daysAgo(26),
    },
  });
  await prisma.campaign.create({
    data: {
      clubId: club.id, name: "הסעות לדרבי בתל אביב", channel: "SMS",
      category: "MARKETING", status: "SENT", reach: 2011,
      body: "נפתחה ההרשמה להסעות למשחק נגד הפועל תל אביב",
      sentAt: daysAgo(33), createdAt: daysAgo(35), gameId: games[3].id,
    },
  });
  await prisma.campaign.create({
    data: {
      clubId: club.id, name: "התעוררות אוהדים רדומים", channel: "EMAIL",
      category: "GOODWILL", status: "DRAFT", reach: 0,
      body: "התגעגענו אליך ביציע! חוזרים הביתה לטרנר",
      createdAt: daysAgo(2),
    },
  });

  // Activity feed
  const events = [
    ["import.completed", "ייבוא אקסל הושלם — 320 אוהדים עודכנו", 1],
    ["campaign.sending", "קמפיין ‘חידוש מנויים’ נשלח ל-3,420 נמענים", 2],
    ["game.created", "נוסף משחק חוץ מול מכבי פתח תקווה (המושבה)", 3],
    ["shuttle.registrations", "142 נרשמים חדשים להסעה לדרבי", 4],
    ["scores.updated", "עודכנו ציוני מעורבות לכלל האוהדים", 5],
  ];
  for (const [type, description, d] of events) {
    await prisma.activityEvent.create({
      data: { clubId: club.id, type, description, createdAt: daysAgo(d) },
    });
  }

  const counts = {
    fans: await prisma.fan.count(),
    subscriptions: await prisma.subscription.count(),
    games: await prisma.game.count(),
    attendances: await prisma.attendance.count(),
    campaigns: await prisma.campaign.count(),
  };
  console.log("Seed complete:", JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
