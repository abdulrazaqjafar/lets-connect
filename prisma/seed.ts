import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PLATFORM_PLANS } from "../src/lib/plan-catalog";

const prisma = new PrismaClient();

async function seedPlans() {
  for (const plan of PLATFORM_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        priceAmount: plan.priceAmount,
        maxSites: plan.maxSites,
        sortOrder: plan.sortOrder,
        highlighted: plan.highlighted,
        features: [...plan.features],
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceAmount: plan.priceAmount,
        maxSites: plan.maxSites,
        sortOrder: plan.sortOrder,
        highlighted: plan.highlighted,
        features: [...plan.features],
      },
    });
  }
}

async function main() {
  await seedPlans();

  const passwordHash = await bcrypt.hash("password123", 10);
  const owner = await prisma.user.upsert({
    where: { email: "owner@letsconnect.local" },
    update: { passwordHash, name: "Demo Site Owner" },
    create: {
      email: "owner@letsconnect.local",
      name: "Demo Site Owner",
      role: "SITE_OWNER",
      phone: "+255700000000",
      passwordHash,
    },
  });

  const serengeti = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { code: "serengeti" },
  });

  await prisma.subscription.updateMany({
    where: { userId: owner.id, status: { in: ["TRIALING", "ACTIVE"] } },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  await prisma.subscription.create({
    data: {
      userId: owner.id,
      planId: serengeti.id,
      status: "ACTIVE",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const site = await prisma.site.upsert({
    where: { nasIdentifier: "NAS-DEMO-001" },
    update: {
      ownerId: owner.id,
      name: "Demo Hotspot",
      slug: "demo-hotspot",
      location: "Dar es Salaam",
      routerModel: "hAP ax2",
      radiusSecret: "demo-radius-secret",
    },
    create: {
      ownerId: owner.id,
      name: "Demo Hotspot",
      slug: "demo-hotspot",
      description: "Local development WiFi location",
      location: "Dar es Salaam",
      address: "Dar es Salaam",
      routerModel: "hAP ax2",
      nasIdentifier: "NAS-DEMO-001",
      radiusSecret: "demo-radius-secret",
      routerHost: "192.168.88.1",
      routerPort: 8728,
      routerUsername: "admin",
    },
  });

  const existingPackage = await prisma.package.findFirst({
    where: { siteId: site.id, name: "Daily 1GB" },
  });

  if (!existingPackage) {
    await prisma.package.create({
      data: {
        siteId: site.id,
        name: "Daily 1GB",
        description: "24-hour access with 1GB data",
        priceAmount: 1000,
        priceCurrency: "TZS",
        validityValue: 24,
        validityUnit: "HOURS",
        downloadLimitKbps: 5000,
        uploadLimitKbps: 2000,
        dataLimitMb: 1024,
        maxDevices: 1,
      },
    });
  }

  console.log("Seed complete");
  console.log(`DEMO_OWNER_ID=${owner.id}`);
  console.log(`DEMO_SITE_ID=${site.id}`);
  console.log("Demo login: owner@letsconnect.local / password123");
  console.log("Plan: Serengeti (3 sites)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
