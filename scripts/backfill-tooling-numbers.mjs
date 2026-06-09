import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const prefixes = {
  'injection-mold': 'TL-INJ',
  'stamping-die': 'TL-STP',
  'die-cast-mold': 'TL-DCM',
  'mim-mold': 'TL-MIM',
  'press-mold': 'TL-PRS',
  gauge: 'TL-GAU',
  fixture: 'TL-FIX',
  jig: 'TL-JIG',
  other: 'TL-OTH',
};

const createNumber = (type, sequence) => `${prefixes[type] ?? prefixes.other}-${String(sequence).padStart(3, '0')}`;

const getSequence = (toolingNumber, type) => {
  const prefix = prefixes[type] ?? prefixes.other;
  if (!toolingNumber?.startsWith(`${prefix}-`)) return 0;
  const sequence = Number(toolingNumber.slice(prefix.length + 1));
  return Number.isFinite(sequence) ? sequence : 0;
};

try {
  const records = await prisma.toolingRecord.findMany({
    select: {
      id: true,
      type: true,
      toolingNumber: true,
      createdAt: true,
    },
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });

  const nextSequenceByType = new Map();
  for (const record of records) {
    if (!record.toolingNumber) continue;
    const type = record.type || 'other';
    nextSequenceByType.set(type, Math.max(nextSequenceByType.get(type) ?? 1, getSequence(record.toolingNumber, type) + 1));
  }

  let updated = 0;
  for (const record of records) {
    if (record.toolingNumber) continue;
    const type = record.type || 'other';
    const sequence = nextSequenceByType.get(type) ?? 1;
    nextSequenceByType.set(type, sequence + 1);
    await prisma.toolingRecord.update({
      where: { id: record.id },
      data: { toolingNumber: createNumber(type, sequence) },
    });
    updated += 1;
  }

  if (updated > 0) {
    console.log(`Backfilled ${updated} tooling number(s).`);
  } else {
    console.log('Tooling numbers already complete.');
  }
} finally {
  await prisma.$disconnect();
}
