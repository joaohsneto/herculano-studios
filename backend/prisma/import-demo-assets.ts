import "dotenv/config";
import { stat } from "node:fs/promises";
import path from "node:path";
import { AssetKind, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const storage = path.resolve(process.env.PRIVATE_STORAGE_PATH ?? "./storage/private");

async function attach(productSlug: string, variantSku: string, storageKey: string, mimeType: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { slug: productSlug }, include: { variants: true } });
  const variant = product.variants.find((item) => item.sku === variantSku);
  if (!variant) throw new Error(`Variante não encontrada: ${variantSku}`);
  const info = await stat(path.join(storage, storageKey));
  await prisma.mediaAsset.upsert({
    where: { storageKey },
    update: { variantId: variant.id, sizeBytes: info.size },
    create: {
      productId: product.id,
      variantId: variant.id,
      kind: AssetKind.DOWNLOAD,
      storageKey,
      fileName: storageKey,
      mimeType,
      sizeBytes: info.size
    }
  });
}

async function main() {
  await attach("afrobeat-type-teto-x-wiu", "BEAT-AFRO-TETO-WIU-MP3", "afrobeat-type-teto-wiu.mp3", "audio/mpeg");
  await attach("afrobeat-type-teto-x-wiu", "BEAT-AFRO-TETO-WIU-WAV", "afrobeat-type-teto-wiu.wav", "audio/wav");
  await attach("brazilian-funk-essentials-series", "DRUMKIT-BFES-001", "brazilian-funk-essentials-series.zip", "application/zip");
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
