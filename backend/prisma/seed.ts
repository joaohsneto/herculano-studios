import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, ProductStatus, ProductType, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "joaovictorhp06@gmail.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("Defina ADMIN_PASSWORD no backend/.env antes de executar o seed.");
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: process.env.ADMIN_NAME ?? "João Victor Herculano Perciano", role: UserRole.ADMIN },
    create: {
      name: process.env.ADMIN_NAME ?? "João Victor Herculano Perciano",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date()
    }
  });

  const beats = await prisma.category.upsert({
    where: { slug: "beats" },
    update: {},
    create: { name: "Beats", slug: "beats" }
  });
  const drumKits = await prisma.category.upsert({
    where: { slug: "drum-kits" },
    update: {},
    create: { name: "Drum Kits", slug: "drum-kits" }
  });

  await prisma.product.upsert({
    where: { slug: "afrobeat-type-teto-x-wiu" },
    update: {},
    create: {
      name: "Afrobeat Type Teto x WIU",
      slug: "afrobeat-type-teto-x-wiu",
      shortDescription: "Afrobeat melódico com atmosfera moderna.",
      description: "Beat completo disponível em MP3 ou WAV. Escolha o formato e a licença antes de adicionar ao carrinho.",
      type: ProductType.BEAT,
      status: ProductStatus.ACTIVE,
      featured: true,
      categoryId: beats.id,
      variants: {
        create: [
          { name: "MP3", sku: "BEAT-AFRO-TETO-WIU-MP3", format: "MP3", licenseName: "Licença MP3", priceCents: 4990 },
          { name: "WAV", sku: "BEAT-AFRO-TETO-WIU-WAV", format: "WAV", licenseName: "Licença WAV", priceCents: 8990 }
        ]
      }
    }
  });

  await prisma.product.upsert({
    where: { slug: "brazilian-funk-essentials-series" },
    update: {},
    create: {
      name: "Brazilian Funk Essentials Series",
      slug: "brazilian-funk-essentials-series",
      shortDescription: "Sons essenciais para produzir funk brasileiro.",
      description: "Coleção organizada de 808s, kicks, claps, hats, percussões, chords, FX, vocals e loops.",
      type: ProductType.DRUM_KIT,
      status: ProductStatus.ACTIVE,
      featured: true,
      categoryId: drumKits.id,
      variants: {
        create: [{ name: "Complete Kit", sku: "DRUMKIT-BFES-001", format: "ZIP", licenseName: "Royalty Free", priceCents: 12990 }]
      },
      previewGroups: {
        create: ["808", "Kick", "Clap", "Hats", "Percs", "Chords", "FX", "Vocals", "Loops"].map((name, position) => ({ name, position }))
      }
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
