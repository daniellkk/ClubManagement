import { Injectable, NotFoundException } from "@nestjs/common";
import { CampaignStatus, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const APP_ACTIVE_DAYS = 30;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO(auth): resolve from authenticated admin user
  private async club() {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new NotFoundException("No club configured");
    return club;
  }

  async dashboard() {
    const club = await this.club();
    const clubId = club.id;

    const currentSeason = await this.prisma.season.findFirst({
      where: { clubId, isCurrent: true },
    });
    const previousSeason = currentSeason
      ? await this.prisma.season.findFirst({
          where: { clubId, startDate: { lt: currentSeason.startDate } },
          orderBy: { startDate: "desc" },
        })
      : null;

    const appActiveSince = new Date();
    appActiveSince.setDate(appActiveSince.getDate() - APP_ACTIVE_DAYS);

    const [totalFans, activeInApp, activeCampaigns] =
      await this.prisma.$transaction([
        this.prisma.fan.count({ where: { clubId, deletedAt: null } }),
        this.prisma.fan.count({
          where: {
            clubId,
            deletedAt: null,
            appLastLoginAt: { gte: appActiveSince },
          },
        }),
        this.prisma.campaign.count({
          where: {
            clubId,
            status: {
              in: [CampaignStatus.SCHEDULED, CampaignStatus.SENDING],
            },
          },
        }),
      ]);

    const activeSubscribers = currentSeason
      ? await this.prisma.subscription.count({
          where: {
            seasonId: currentSeason.id,
            status: SubscriptionStatus.ACTIVE,
          },
        })
      : 0;

    // Not renewed = had a subscription last season, no active one this season
    let notRenewed = 0;
    if (currentSeason && previousSeason) {
      const [prev, curr] = await this.prisma.$transaction([
        this.prisma.subscription.findMany({
          where: { seasonId: previousSeason.id },
          select: { fanId: true },
        }),
        this.prisma.subscription.findMany({
          where: {
            seasonId: currentSeason.id,
            status: SubscriptionStatus.ACTIVE,
          },
          select: { fanId: true },
        }),
      ]);
      const current = new Set(curr.map((s) => s.fanId));
      notRenewed = prev.filter((s) => !current.has(s.fanId)).length;
    }

    // Cumulative fan growth over the last 6 months
    const months: { label: string; end: Date }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = new Date(now.getFullYear(), now.getMonth() - i, 1)
        .toLocaleDateString("he-IL", { month: "long" });
      months.push({ label, end });
    }
    const fanGrowth = await Promise.all(
      months.map(async ({ label, end }) => ({
        month: label,
        fans: await this.prisma.fan.count({
          where: { clubId, deletedAt: null, createdAt: { lt: end } },
        }),
      })),
    );

    const [recentCampaigns, activityFeed] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where: { clubId },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          name: true,
          status: true,
          reach: true,
          createdAt: true,
        },
      }),
      this.prisma.activityEvent.findMany({
        where: { clubId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, description: true, createdAt: true },
      }),
    ]);

    return {
      club: { name: club.name, primaryColor: club.primaryColor },
      season: currentSeason?.name ?? null,
      kpis: {
        totalFans,
        activeSubscribers,
        notRenewed,
        activeInApp,
        activeCampaigns,
      },
      fanGrowth,
      subscriberSplit: {
        active: activeSubscribers,
        notRenewed,
        noSubscription: Math.max(
          0,
          totalFans - activeSubscribers - notRenewed,
        ),
      },
      recentCampaigns,
      activityFeed,
    };
  }
}
