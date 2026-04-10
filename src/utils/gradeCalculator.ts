export type TipeItem = 'MATERI' | 'PDF' | 'YOUTUBE' | 'KUIS' | 'TUGAS';

export interface ModulItem {
  id: string;
  tipe_item: TipeItem | string;
  bobot_item?: number;
}

export interface ProgresSiswa {
  modul_item_id: string;
  nilai?: number | null;
  status_selesai: boolean;
}

export interface BobotKategori {
  k1: number;
  k2: number;
  k3: number;
}

export interface GradeResult {
  finalGrade: number | null;
  currentGrade: number | null;
  breakdown: {
    K1: number | null;
    K2: number | null;
    K3: number | null;
  };
  needsGrading: boolean;
  isComplete: boolean;
}

export function calculateGrade(
  items: ModulItem[],
  progressList: ProgresSiswa[],
  bobot: BobotKategori = { k1: 20, k2: 30, k3: 50 }
): GradeResult {
  if (!items || items.length === 0) {
    return { finalGrade: 0, currentGrade: 0, breakdown: { K1: null, K2: null, K3: null }, needsGrading: false, isComplete: false };
  }

  const categories = {
    K1: items.filter(i => ['MATERI', 'PDF', 'YOUTUBE'].includes(i.tipe_item)),
    K2: items.filter(i => i.tipe_item === 'KUIS'),
    K3: items.filter(i => i.tipe_item === 'TUGAS'),
  };

  let needsGrading = false;
  let isComplete = true;

  const calcCategory = (categoryItems: ModulItem[], mode: 'CURRENT' | 'FINAL'): number | null => {
    if (categoryItems.length === 0) return null;

    let totalScore = 0;
    let totalWeight = 0;

    categoryItems.forEach(item => {
      const progress = progressList.find(p => p.modul_item_id === item.id);
      const itemWeight = item.bobot_item && item.bobot_item > 0 ? item.bobot_item : 1;

      let itemScore: number | null = null;

      if (!progress || !progress.status_selesai) {
        isComplete = false;
        itemScore = mode === 'FINAL' ? 0 : null;
      } else {
        // Completed
        if (['MATERI', 'PDF', 'YOUTUBE'].includes(item.tipe_item)) {
          itemScore = 100; // K1 fallback: 100 for completion
        } else if (item.tipe_item === 'KUIS') {
          itemScore = typeof progress.nilai === 'number' ? progress.nilai : 0;
        } else if (item.tipe_item === 'TUGAS') {
          if (typeof progress.nilai === 'number') {
            itemScore = progress.nilai;
          } else {
            needsGrading = true;
            itemScore = mode === 'FINAL' ? 0 : null; 
          }
        }
      }

      if (itemScore !== null) {
        totalScore += itemScore * itemWeight;
        totalWeight += itemWeight;
      }
    });

    return totalWeight > 0 ? totalScore / totalWeight : (mode === 'FINAL' ? 0 : null);
  };

  const finalK1 = calcCategory(categories.K1, 'FINAL');
  const finalK2 = calcCategory(categories.K2, 'FINAL');
  const finalK3 = calcCategory(categories.K3, 'FINAL');

  const currentK1 = calcCategory(categories.K1, 'CURRENT');
  const currentK2 = calcCategory(categories.K2, 'CURRENT');
  const currentK3 = calcCategory(categories.K3, 'CURRENT');

  const calculateTotal = (k1: number | null, k2: number | null, k3: number | null): number | null => {
    let activeWeightTotal = 0;
    if (k1 !== null) activeWeightTotal += bobot.k1;
    if (k2 !== null) activeWeightTotal += bobot.k2;
    if (k3 !== null) activeWeightTotal += bobot.k3;

    if (activeWeightTotal === 0) return null;

    let total = 0;
    if (k1 !== null) total += k1 * (bobot.k1 / activeWeightTotal);
    if (k2 !== null) total += k2 * (bobot.k2 / activeWeightTotal);
    if (k3 !== null) total += k3 * (bobot.k3 / activeWeightTotal);

    // Minimum requirement cap: if K3 exists but score is 0, cap at 60
    if (categories.K3.length > 0 && k3 === 0 && total > 60) {
      total = 60;
    }

    return Math.max(0, Math.min(100, Number(total.toFixed(2))));
  };

  const finalGrade = calculateTotal(finalK1, finalK2, finalK3);
  const currentGrade = calculateTotal(currentK1, currentK2, currentK3);

  return {
    finalGrade: needsGrading ? null : finalGrade,
    currentGrade,
    breakdown: {
      K1: finalK1 !== null ? Number(finalK1.toFixed(2)) : null,
      K2: finalK2 !== null ? Number(finalK2.toFixed(2)) : null,
      K3: finalK3 !== null ? Number(finalK3.toFixed(2)) : null,
    },
    needsGrading,
    isComplete
  };
}
